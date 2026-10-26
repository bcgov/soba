// Must be first: initializes .env + .env.local for this process.
import { env } from '../core/config/env';
env.loadEnv();

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';

import { sql, TransactionRollbackError } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { fromDrizzle, PgBoss, type ConstructorOptions, type Job, type JobAttempt } from 'pg-boss';

const SCHEMA = 'queue_probe';
const QUEUE_TX = 'probe-tx';
const QUEUE_CLAIM = 'probe-claim';
const QUEUE_EXPIRE = 'probe-expire';
const QUEUE_CANCEL = 'probe-cancel';
const QUEUE_CANCEL_HEARTBEAT = 'probe-cancel-heartbeat';
const URL_ENV = 'QUEUE_PROBE_URL';
const WAIT_MS = 20_000;

const USAGE = `Job queue probe: pg-boss and a hand-built claim against one Postgres URL.

Usage, from backend/:
  pnpm exec tsx src/spikes/pgQueueProbe.ts
  node dist/src/spikes/pgQueueProbe.js

Connects to ${URL_ENV}, or DATABASE_URL when it is unset. Drops and recreates the ${SCHEMA}
schema, and drops it at the end. Exit code 1 when any check fails.`;

const CLAIM_SQL = `
update queue_probe.hb_job
   set status = 'running', claim_token = gen_random_uuid(), attempts = attempts + 1,
       lease_until = now() + make_interval(secs => $2)
 where id in (
   select id from queue_probe.hb_job
    where type = any($1) and cancel_requested_at is null and attempts < max_attempts
      and ((status = 'queued' and run_after <= now()) or (status = 'running' and lease_until < now()))
    order by run_after
    limit $3
    for update skip locked)
returning id, claim_token`;

const HEARTBEAT_SQL = `
update queue_probe.hb_job set lease_until = now() + interval '60 seconds'
 where id = $1 and claim_token = $2`;

type ProbeDb = NodePgDatabase;
type ProbeTx = Parameters<Parameters<ProbeDb['transaction']>[0]>[0];

interface CheckResult {
  ok: boolean | null;
  detail: string;
}

interface Claimed {
  id: string;
  claim_token: string;
}

const results: string[] = [];
const bossEvents: string[] = [];

function outcomeOf(ok: boolean | null): string {
  if (ok === null) return 'INFO';
  return ok ? 'PASS' : 'FAIL';
}

async function record(name: string, run: () => Promise<CheckResult>): Promise<boolean> {
  try {
    const { ok, detail } = await run();
    results.push(`${outcomeOf(ok)} ${name}: ${detail}`);
    return ok !== false;
  } catch (error) {
    results.push(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

function report(): void {
  const lines = [...results, ...bossEvents];
  for (const line of lines) console.log(line);
  process.exitCode = lines.some((line) => line.startsWith('FAIL')) ? 1 : 0;
}

function describeTarget(url: string): string {
  const parsed = new URL(url);
  return `${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`;
}

function newBoss(url: string, overrides: Partial<ConstructorOptions> = {}): PgBoss {
  const boss = new PgBoss({
    connectionString: url,
    schema: SCHEMA,
    max: 4,
    schedule: false,
    superviseIntervalSeconds: 1,
    monitorIntervalSeconds: 1,
    ...overrides,
  });
  boss.on('error', (error: Error) => bossEvents.push(`FAIL pg-boss error event: ${error.message}`));
  boss.on('warning', (warning) => bossEvents.push(`INFO pg-boss warning: ${warning.message}`));
  return boss;
}

async function waitFor<T>(probe: () => Promise<T | undefined>, deadline: number): Promise<T> {
  const value = await probe();
  if (value !== undefined) return value;
  if (Date.now() >= deadline) throw new Error(`timed out after ${WAIT_MS} ms`);
  await sleep(500);
  return waitFor(probe, deadline);
}

async function rejectAfter(message: string): Promise<never> {
  await sleep(WAIT_MS, undefined, { ref: false });
  throw new Error(`${message} in ${WAIT_MS} ms`);
}

async function abortedWithin(signal: AbortSignal, ms: number): Promise<boolean> {
  if (signal.aborted) return true;
  try {
    await once(signal, 'abort', { signal: AbortSignal.timeout(ms) });
    return true;
  } catch {
    return false;
  }
}

async function stateOf(boss: PgBoss, queue: string, id: string): Promise<string> {
  const [job] = await boss.findJobs(queue, { id });
  return job?.state ?? 'missing';
}

/** Handler result for the first job a worker takes. The worker is not waited on to settle it. */
async function runOnce<T>(
  boss: PgBoss,
  queue: string,
  onJob: (job: Job) => Promise<T>,
): Promise<T> {
  const delivered = new Promise<T>((resolve, reject) => {
    boss
      .work<object>(queue, { pollingIntervalSeconds: 0.5 }, async ([job]) => {
        await onJob(job).then(resolve, reject);
      })
      .catch(reject);
  });
  try {
    return await Promise.race([delivered, rejectAfter(`no job delivered from ${queue}`)]);
  } finally {
    await boss.offWork(queue, { wait: false });
  }
}

/** A pooler can accept the timeouts at connect and still drop them, so the session is read back. */
async function connectCheck(url: string, withTimeouts: boolean): Promise<CheckResult> {
  const statementMs = env.getDbStatementTimeoutMs();
  const lockMs = env.getDbLockTimeoutMs();
  const pool = new Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: env.getDbConnectionTimeoutMs(),
    ...(withTimeouts ? { statement_timeout: statementMs, lock_timeout: lockMs } : {}),
  });
  try {
    const { rows } = await pool.query<{ statement_ms: string; lock_ms: string }>(
      `select (extract(epoch from current_setting('statement_timeout')::interval) * 1000)::bigint as statement_ms,
              (extract(epoch from current_setting('lock_timeout')::interval) * 1000)::bigint as lock_ms`,
    );
    const statement = Number(rows[0].statement_ms);
    const lock = Number(rows[0].lock_ms);
    const detail = `session has statement_timeout ${statement} ms, lock_timeout ${lock} ms`;
    if (!withTimeouts) return { ok: true, detail };
    return {
      ok: statement === statementMs && lock === lockMs,
      detail: `${detail}; configured ${statementMs} ms and ${lockMs} ms`,
    };
  } finally {
    await pool.end();
  }
}

async function dropProbeSchema(pool: Pool): Promise<CheckResult> {
  await pool.query(`drop schema if exists queue_probe cascade`);
  return { ok: true, detail: `${SCHEMA} absent` };
}

async function startCheck(pool: Pool, boss: PgBoss): Promise<CheckResult> {
  await boss.start();
  const { rows } = await pool.query<{ role: string; installed: boolean }>(
    `select current_user as role,
            exists (select 1 from information_schema.schemata where schema_name = $1) as installed`,
    [SCHEMA],
  );
  const version = await boss.schemaVersion();
  return {
    ok: rows[0].installed,
    detail: `schema ${SCHEMA} created as role ${rows[0].role}, schema version ${version}`,
  };
}

async function insertWithJob(tx: ProbeTx, boss: PgBoss): Promise<void> {
  await tx.execute(sql`insert into queue_probe.probe_row default values`);
  await boss.send(QUEUE_TX, {}, { db: fromDrizzle(tx, sql) });
}

async function txCounts(db: ProbeDb, boss: PgBoss): Promise<string> {
  const { rows } = await db.execute<{ n: number }>(
    sql`select count(*)::int as n from queue_probe.probe_row`,
  );
  const jobs = await boss.findJobs(QUEUE_TX);
  return `${rows[0].n} row/${jobs.length} job`;
}

async function sendInTransactionCheck(db: ProbeDb, boss: PgBoss): Promise<CheckResult> {
  await db.execute(sql`create table queue_probe.probe_row (id serial primary key)`);
  await boss.createQueue(QUEUE_TX);
  await db
    .transaction(async (tx) => {
      await insertWithJob(tx, boss);
      tx.rollback();
    })
    .catch((error: unknown) => {
      if (!(error instanceof TransactionRollbackError)) throw error;
    });
  const afterRollback = await txCounts(db, boss);
  await db.transaction((tx) => insertWithJob(tx, boss));
  const afterCommit = await txCounts(db, boss);
  return {
    ok: afterRollback === '0 row/0 job' && afterCommit === '1 row/1 job',
    detail: `after rollback ${afterRollback}, after commit ${afterCommit}`,
  };
}

/** The child's env loader also writes to stdout; its result is the first JSON line. */
async function firstJsonLine(input: Readable): Promise<string> {
  for await (const line of createInterface({ input })) {
    if (line.startsWith('{')) return line;
  }
  throw new Error('claim child exited without printing a job');
}

async function claimInChild(url: string): Promise<JobAttempt> {
  const child = spawn(process.execPath, [...process.execArgv, process.argv[1], '--claim'], {
    env: { ...process.env, [URL_ENV]: url },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  try {
    const line = await Promise.race([
      firstJsonLine(child.stdout),
      rejectAfter('claim child printed no job'),
    ]);
    return JSON.parse(line) as JobAttempt;
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await once(child, 'exit');
    }
  }
}

async function killedWorkerCheck(url: string, boss: PgBoss): Promise<CheckResult> {
  await boss.createQueue(QUEUE_CLAIM, { expireInSeconds: 2, retryLimit: 3 });
  const id = await boss.send(QUEUE_CLAIM, {});
  if (!id) return { ok: false, detail: 'send returned no id' };
  const first = await claimInChild(url);
  const second = await waitFor(
    async () => (await boss.fetch(QUEUE_CLAIM))[0],
    Date.now() + WAIT_MS,
  );
  await boss.complete(QUEUE_CLAIM, first);
  const afterStale = await stateOf(boss, QUEUE_CLAIM, id);
  await boss.complete(QUEUE_CLAIM, second);
  const afterCurrent = await stateOf(boss, QUEUE_CLAIM, id);
  const reclaimed = first.id === id && second.id === id && second.retryCount > first.retryCount;
  return {
    ok: reclaimed && afterStale === 'active' && afterCurrent === 'completed',
    detail:
      `attempt ${first.retryCount} killed, attempt ${second.retryCount} reclaimed; ` +
      `stale complete left ${afterStale}, current complete left ${afterCurrent}`,
  };
}

async function expiryCheck(boss: PgBoss): Promise<CheckResult> {
  await boss.createQueue(QUEUE_EXPIRE, { expireInSeconds: 1, retryLimit: 0 });
  await boss.send(QUEUE_EXPIRE, {});
  const aborted = await runOnce(boss, QUEUE_EXPIRE, (job) => abortedWithin(job.signal, 10_000));
  return { ok: aborted, detail: aborted ? 'job.signal aborted' : 'job.signal not aborted in 10 s' };
}

/** cancel() only updates the row; a running handler hears of it through the heartbeat, if any. */
async function cancelRunningCheck(
  boss: PgBoss,
  queue: string,
  heartbeatSeconds?: number,
): Promise<CheckResult> {
  await boss.createQueue(queue, {
    expireInSeconds: 60,
    ...(heartbeatSeconds && { heartbeatSeconds }),
  });
  const id = await boss.send(queue, {});
  if (!id) return { ok: false, detail: 'send returned no id' };
  const aborted = await runOnce(boss, queue, async (job) => {
    await boss.cancel(queue, job.id);
    return abortedWithin(job.signal, 12_000);
  });
  const state = await stateOf(boss, queue, id);
  return {
    ok: null,
    detail: `handler signal aborted within 12 s: ${aborted ? 'yes' : 'no'}; job state ${state}`,
  };
}

async function seedHandBuiltJobs(pool: Pool): Promise<void> {
  await pool.query(`create schema if not exists queue_probe`);
  await pool.query(`
    create table queue_probe.hb_job (
      id uuid primary key default gen_random_uuid(),
      type text not null,
      status text not null default 'queued',
      attempts int not null default 0,
      max_attempts int not null default 3,
      run_after timestamptz not null default now(),
      lease_until timestamptz,
      claim_token uuid,
      cancel_requested_at timestamptz)`);
  await pool.query(`insert into queue_probe.hb_job (type) values ('probe'), ('probe')`);
}

async function handBuiltClaimCheck(pool: Pool): Promise<CheckResult> {
  await seedHandBuiltJobs(pool);
  const holder = await pool.connect();
  const other = await pool.connect();
  try {
    await holder.query('begin');
    const first = await holder.query<Claimed>(CLAIM_SQL, [['probe'], 60, 1]);
    await other.query('begin');
    // Without skip locked this claim would wait on the held row; the timeout turns that into a failure.
    await other.query(`set local lock_timeout = '2s'`);
    const second = await other.query<Claimed>(CLAIM_SQL, [['probe'], 60, 1]);
    await other.query('commit');
    await holder.query('commit');
    const [claimed] = first.rows;
    const distinct = new Set([...first.rows, ...second.rows].map((row) => row.id)).size;
    const stale = await pool.query(HEARTBEAT_SQL, [claimed.id, randomUUID()]);
    const current = await pool.query(HEARTBEAT_SQL, [claimed.id, claimed.claim_token]);
    return {
      ok: distinct === 2 && stale.rowCount === 0 && current.rowCount === 1,
      detail:
        `a claim made while another was held open took ${distinct === 2 ? 'the other' : 'the same'} row; ` +
        `heartbeat with a wrong token updated ${stale.rowCount}, with the claim token ${current.rowCount}`,
    };
  } finally {
    holder.release(true);
    other.release(true);
  }
}

async function bossChecks(url: string, pool: Pool, db: ProbeDb): Promise<void> {
  const boss = newBoss(url);
  try {
    if (!(await record('pg-boss start', () => startCheck(pool, boss)))) return;
    await record('send inside a Drizzle transaction', () => sendInTransactionCheck(db, boss));
    await record('killed worker and stale complete', () => killedWorkerCheck(url, boss));
    await record('expiry aborts the handler signal', () => expiryCheck(boss));
    await record('cancel of a running job, no heartbeat', () =>
      cancelRunningCheck(boss, QUEUE_CANCEL),
    );
    await record('cancel of a running job, heartbeatSeconds 10', () =>
      cancelRunningCheck(boss, QUEUE_CANCEL_HEARTBEAT, 10),
    );
  } finally {
    await record('pg-boss stop', async () => {
      await boss.stop({ timeout: 5_000 });
      return { ok: true, detail: 'stopped' };
    });
  }
}

async function probe(url: string): Promise<void> {
  console.log(`Target ${describeTarget(url)}`);
  await record('connect with the backend pool settings', () => connectCheck(url, true));
  await record('connect without statement and lock timeouts', () => connectCheck(url, false));

  const pool = new Pool({
    connectionString: url,
    max: 4,
    connectionTimeoutMillis: env.getDbConnectionTimeoutMs(),
  });
  try {
    if (await record('reset the probe schema', () => dropProbeSchema(pool))) {
      await bossChecks(url, pool, drizzle(pool));
      await record('hand-built claim and fencing', () => handBuiltClaimCheck(pool));
    }
  } finally {
    await record('drop the probe schema', () => dropProbeSchema(pool));
    report();
    await pool.end();
  }
}

async function claimAndHold(url: string): Promise<void> {
  const boss = newBoss(url, { max: 1, supervise: false, migrate: false });
  await boss.start();
  try {
    const [job] = await boss.fetch(QUEUE_CLAIM);
    console.log(JSON.stringify({ id: job?.id, retryCount: job?.retryCount }));
    await sleep(10 * WAIT_MS);
  } finally {
    await boss.stop({ graceful: false });
  }
}

const { values } = parseArgs({
  options: {
    claim: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

function main(): Promise<void> {
  if (values.help) {
    console.log(USAGE);
    return Promise.resolve();
  }
  const url = env.getOptionalEnv(URL_ENV) ?? env.getDatabaseUrl();
  return values.claim ? claimAndHold(url) : probe(url);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
