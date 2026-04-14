/**
 * Submit a sample Temporal workflow and wait for its result.
 * Use this to verify the deployed Temporal server, worker, and UI are working.
 *
 * Usage (from backend/):
 *   # Against the default TEMPORAL_ADDRESS from .env (localhost:7233 for local dev)
 *   pnpm script:test-temporal
 *
 *   # Override the address (e.g. after port-forwarding to OpenShift)
 *   #   oc port-forward svc/temporal-frontend -n acf456-dev 7233:7233
 *   TEMPORAL_ADDRESS=localhost:7233 pnpm script:test-temporal
 *
 *   # Pass a custom name argument
 *   pnpm script:test-temporal -- --name=OpenShift
 *
 * After running, open the Temporal UI (port-forward svc/temporal-web -n acf456-dev 8080:8080)
 * and look for the printed workflowId in the "default" namespace.
 *
 * Database check — connect to the temporal DB and run:
 *   SELECT workflow_id, run_id, workflow_type_name, status, start_time, close_time
 *   FROM executions
 *   ORDER BY start_time DESC
 *   LIMIT 10;
 */
import '../dotenv-init';

import { Client, Connection } from '@temporalio/client';
import { sampleWorkflow } from '../src/temporal/workflows/sampleWorkflow';

function parseName(): string {
  const arg = process.argv.find((a) => a.startsWith('--name='));
  return arg?.slice(7) || 'World';
}

async function main() {
  const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
  const namespace = process.env.TEMPORAL_NAMESPACE ?? 'default';
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE ?? 'soba';
  const name = parseName();

  console.log(`Connecting to Temporal at ${address} (namespace: ${namespace})`);

  const connection = await Connection.connect({ address });
  const client = new Client({ connection, namespace });

  const workflowId = `sample-${Date.now()}`;

  console.log(`Starting sampleWorkflow (workflowId: ${workflowId}, name: "${name}")`);

  const handle = await client.workflow.start(sampleWorkflow, {
    taskQueue,
    workflowId,
    args: [name],
  });

  console.log(`Workflow started. Waiting for result...`);
  console.log(`  → Look it up in the Temporal UI: namespace=${namespace}, workflowId=${workflowId}`);

  const result = await handle.result();

  console.log(`\nResult: ${result}`);
  console.log(`\nWorkflow completed successfully.`);
  console.log(`  workflowId : ${workflowId}`);
  console.log(`  runId      : ${handle.firstExecutionRunId}`);

  await connection.close();
}

main().catch((err) => {
  console.error('test-temporal failed:', (err as Error).message);
  process.exit(1);
});
