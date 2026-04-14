# Testing the Temporal Deployment

How to verify that the Temporal server, worker, and UI are working correctly — both locally and against a deployed OpenShift environment.

---

## Prerequisites — build the worker code first

The OpenShift worker runs compiled JavaScript (`node dist/temporal-worker.js`). Before deploying or testing, the TypeScript must be compiled so the `dist/` output includes the sample workflow and activity.

From `backend/`:

```bash
# Inside devcontainer
pnpm build

# Outside devcontainer (bare WSL shell)
npx tsc
```

Verify the compiled files include the new exports:

```bash
cat dist/src/temporal/workflows/index.js
# Expected: exports.sampleWorkflow = ...

cat dist/src/temporal/activities/index.js
# Expected: exports.sample = ...
```

After building, a new worker image must be built and pushed (via GitHub Actions or locally) and the worker Deployment redeployed in OpenShift before the end-to-end test will complete.

---

## What gets tested

Running the test script:

1. Connects to the Temporal server over gRPC
2. Submits a `sampleWorkflow` to the `soba` task queue
3. Waits for the deployed worker to pick it up and execute the `sample` activity
4. Prints the result and the workflow ID
5. The workflow appears in the Temporal UI under the `TEMPORAL_NAMESPACE` (e.g. `soba-pr-45` on OpenShift, `default` locally)

---

## Files involved

| File | Purpose |
| ---- | ------- |
| `backend/scripts/test-temporal.ts` | Script — connects, submits workflow, waits for result |
| `backend/src/temporal/workflows/sampleWorkflow.ts` | Calls the `sample` activity |
| `backend/src/temporal/activities/sample.ts` | Returns a greeting string — the actual work |

---

## Testing locally (devcontainer)

**Prerequisites:** Temporal containers running and the worker process started.

```bash
# Start Temporal and its dependencies (from repo root)
docker compose -f .devcontainer/docker-compose.yml up -d postgres temporal temporal-ui

# Start the worker (from backend/) — inside devcontainer
pnpm temporal-worker:dev

# Outside devcontainer
npx tsx watch temporal-worker.ts
```

Run the script in a separate terminal (from `backend/`):

```bash
# Inside devcontainer
pnpm script:test-temporal
pnpm script:test-temporal -- --name=LocalTest

# Outside devcontainer (bare WSL shell)
npx tsx scripts/test-temporal.ts
npx tsx scripts/test-temporal.ts -- --name=LocalTest
```

Expected output:

```
Connecting to Temporal at localhost:7233 (namespace: default)
Starting sampleWorkflow (workflowId: sample-1713000000000, name: "World")
Workflow started. Waiting for result...
  → Look it up in the Temporal UI: namespace=default, workflowId=sample-1713000000000

Result: Hello, World! Temporal is working on OpenShift.

Workflow completed successfully.
  workflowId : sample-1713000000000
  runId      : <uuid>
```

Open the UI at `http://localhost:8080` and search for the printed `workflowId`.

---

## Testing against OpenShift

### Step 1 — Port-forward the Temporal gRPC port

```bash
oc port-forward svc/temporal-frontend -n acf456-dev 7233:7233
```

Keep this terminal open.

> **Note:** If the local devcontainer is running, its Temporal container already occupies port 7233. Use port 7234 instead to avoid the conflict:
> ```bash
> oc port-forward svc/temporal-frontend -n acf456-dev 7234:7233
> ```
> Then use `TEMPORAL_ADDRESS=localhost:7234` in Step 2.

### Step 2 — Find the Temporal namespace

The Temporal namespace is set per Helm release (e.g. `soba-pr-45`). Check the configmap:

```bash
oc get configmap -n acf456-dev -l app.kubernetes.io/component=temporal -o jsonpath='{.items[0].data.TEMPORAL_NAMESPACE}'
```

### Step 3 — Run the script

In a separate terminal (from `backend/`):

```bash
# Inside devcontainer (7233 available, port-forward on 7233)
TEMPORAL_ADDRESS=localhost:7233 TEMPORAL_NAMESPACE=soba-pr-45 pnpm script:test-temporal -- --name=OpenShift

# Outside devcontainer (bare WSL shell; use 7234 if local docker Temporal holds 7233)
TEMPORAL_ADDRESS=localhost:7234 TEMPORAL_NAMESPACE=soba-pr-45 npx tsx backend/scripts/test-temporal.ts -- --name=OpenShift
```

The script connects through the port-forward. The worker running in OpenShift picks up the task and executes it.

### Step 3 — View the workflow in the UI

Port-forward the Temporal UI:

```bash
oc port-forward svc/temporal-web -n acf456-dev 8080:8080
```

Open `http://localhost:8080`. Navigate to the `default` namespace and search for the `workflowId` printed by the script. You should see:

- **Status**: Completed
- **Workflow type**: `sampleWorkflow`
- **Task queue**: `soba`
- **Input / Result**: the name argument and returned greeting

---

## Testing on OpenShift without port-forwarding

Three approaches that work entirely inside the cluster — no `oc port-forward` needed.

---

### Method 1 — Connectivity check via `oc exec`

Exec into the worker pod and verify it can reach the Temporal server over the internal cluster DNS. No workflow is submitted — this is a quick smoke test only.

```bash
oc exec -it deployment/temporal-worker -- \
  node -e "
    const { Connection } = require('@temporalio/client');
    Connection.connect({ address: 'temporal:7233' })
      .then(() => { console.log('Connected OK'); process.exit(0); })
      .catch(e => { console.error('Failed:', e.message); process.exit(1); });
  "
```

Expected: `Connected OK`

---

### Method 2 — Submit and inspect workflows with `tctl` inside the Temporal pod

The `temporalio/auto-setup` image ships with the `tctl` CLI. Exec into the Temporal server pod to submit a workflow and inspect results — all from inside the cluster.

**Check namespace and task queue:**

```bash
# List namespaces (should show "default")
oc exec -it deployment/temporal -- tctl namespace list

# Check the soba task queue has active pollers (the worker)
oc exec -it deployment/temporal -- tctl --namespace default taskqueue describe --taskqueue soba --taskqueuetype workflow
```

**Submit a workflow:**

```bash
oc exec -it deployment/temporal -- \
  tctl --namespace default workflow run \
    --tq soba \
    --wt sampleWorkflow \
    --et 60 \
    -i '"OpenShift"'
```

The `-i` flag takes JSON — the string `"OpenShift"` is the `name` argument to `sampleWorkflow`.

**List recent workflows:**

```bash
oc exec -it deployment/temporal -- \
  tctl --namespace default workflow list
```

**Show the result of a specific run:**

```bash
oc exec -it deployment/temporal -- \
  tctl --namespace default workflow show -w <workflow-id>
```

A completed workflow will show its result in the event history at the bottom of the output.

---

### Method 3 — Trigger via the API server Route

If the API server has a route that starts a Temporal workflow (once real features are added), you can hit it with `curl` using the externally exposed Route — no port-forward needed. The workflow submission goes: `curl → API Route → API pod → temporal:7233 (internal) → worker pod`.

This is the pattern all production workflows will follow. For now, use Method 1 or 2 for ad-hoc testing until a real workflow-triggering endpoint exists in the API.

---

## Checking data in the Temporal database

Port-forward to Postgres and connect to the `temporal` database:

```bash
# Port-forward (use your actual postgres service name)
oc port-forward svc/<postgres-service-name> 5432:5432

# Connect
psql -h localhost -U temporal -d temporal
```

### Useful queries

```sql
-- Recent workflow executions (status: 1 = running, 2 = completed, 3 = failed, 4 = cancelled, 5 = terminated)
SELECT workflow_id, run_id, workflow_type_name, status, start_time, close_time
FROM executions
ORDER BY start_time DESC
LIMIT 10;

-- Activity schedules for the sample workflow
SELECT workflow_id, activity_id, activity_type_name, schedule_time, start_time, close_time
FROM activity_info_maps
ORDER BY schedule_time DESC
LIMIT 10;

-- Task queues the worker is registered on
SELECT task_queue_name, task_queue_type, range_id
FROM task_queues
WHERE task_queue_name = 'soba';

-- Namespaces (should show "default")
SELECT id, name, status
FROM namespaces;
```

---

## Troubleshooting

**`unable to listen on port 7233: address already in use`**

The local devcontainer Temporal is already bound to port 7233. Use 7234 instead:

```bash
oc port-forward svc/temporal-frontend -n acf456-dev 7234:7233
TEMPORAL_ADDRESS=localhost:7234 npx tsx scripts/test-temporal.ts -- --name=OpenShift
```

Check what's using 7233: `docker ps --filter "expose=7233"`

**`Namespace not found: 'default'`**

The Temporal server doesn't have a `default` namespace — it uses a per-release namespace (e.g. `soba-pr-45`). Set `TEMPORAL_NAMESPACE`:

```bash
# Find the namespace
oc get configmap -n acf456-dev -l app.kubernetes.io/component=temporal -o jsonpath='{.items[0].data.TEMPORAL_NAMESPACE}'

# Pass it to the script
TEMPORAL_ADDRESS=localhost:7234 TEMPORAL_NAMESPACE=soba-pr-45 npx tsx backend/scripts/test-temporal.ts -- --name=OpenShift
```

**Script exits with "connection refused"**

The Temporal server is not reachable. Check:

- Port-forward is running: `oc port-forward svc/temporal-frontend -n acf456-dev 7233:7233`
- Temporal server pod is healthy: `oc get pods -l app=temporal`

**Script connects but result never comes back**

The worker is not picking up the task. Check:

- Worker pod is running: `oc get pods -l app=temporal-worker`
- Worker logs show "Worker started, polling for tasks": `oc logs -l app=temporal-worker --tail=20`
- Worker image was rebuilt after the sample workflow was added (see Prerequisites above)
- `TEMPORAL_TASK_QUEUE` is `soba` in both the worker Deployment and the script (default is `soba`)

**Workflow shows as "Running" in UI but never completes**

The worker started the task but the activity is stuck. Check worker logs for errors:

```bash
oc logs -l app=temporal-worker --tail=50
```

**`TEMPORAL_ALLOWED` is false**

The script connects directly using `@temporalio/client` and does not check `TEMPORAL_ALLOWED` — that flag only gates the worker process and the Express `getClient()` helper. The test script works regardless of that setting.
