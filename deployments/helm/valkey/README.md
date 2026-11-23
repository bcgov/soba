# valkey

Standalone Valkey (Redis-compatible) chart backing SOBA's shared cache, message bus and event
streams, so a cached value, a published event and a stream are the same on every backend replica
instead of per-pod.

Deployed by hand as per-namespace shared infra, **before** soba — the same model as `clamav`. No
pipeline installs it. Every soba deployment runs its cache, message bus and event streams on it (the
soba chart refuses the `*-memory` plugins), reaching it through an in-namespace
`<soba-release>-valkey` ExternalName alias. Releases that share a namespace share its Valkey under
per-release prefixes: test and UAT in `b82f30-test`, and PR slots in `b82f30-dev`.

## Deploy

Log in to Gold (`oc login --server=https://api.gold.devops.gov.bc.ca:6443 ...`), then run from the
repo root:

```sh
helm upgrade --install valkey ./deployments/helm/valkey \
  -f ./deployments/helm/valkey/values-dev.yaml -n b82f30-dev

helm upgrade --install valkey ./deployments/helm/valkey \
  -f ./deployments/helm/valkey/values-test.yaml -n b82f30-test

helm upgrade --install valkey ./deployments/helm/valkey \
  -f ./deployments/helm/valkey/values-prod.yaml -n b82f30-prod
```

Release it as `valkey` (or set `fullnameOverride: valkey`) so its Service is named `valkey` — the
soba chart's default alias points at `valkey.<namespace>.svc.cluster.local`. For any other release
name, set `valkey.externalName` in the soba values instead. The soba backend then connects with
`PLUGIN_{CACHE,MESSAGEBUS,EVENTSTREAM}_REDIS_URL=redis://<soba-release>-valkey:6379`.

Check it with `oc -n <namespace> exec deploy/valkey -- valkey-cli INFO persistence` (`aof_enabled:1`
in dev, test and prod).

## Notes

- Single instance. Dev, test and prod host event streams, so they persist an AOF to a PVC and use
  `volatile-lru`: cache entries (which carry a TTL) are evicted under memory pressure, stream keys
  (no TTL) never are. Prod's volume is `netapp-block-standard`.
- With persistence on, the Deployment uses `Recreate`, so an upgrade briefly stops Valkey. The cache
  falls back to its source of truth meanwhile, and the bus and stream clients reconnect.
- Turning persistence on for an existing release (rolling update to `Recreate`) fails under Helm 4's
  server-side apply: the API server keeps the defaulted `rollingUpdate` and rejects it alongside
  `Recreate`. A server dry run does not catch this. Run that one upgrade with `--server-side=false`;
  the client-side patch clears `rollingUpdate`. Fresh installs and later upgrades are unaffected.
- The chart defaults (no persistence, `allkeys-lru`) suit a Valkey that only holds the cache.
- A NetworkPolicy (`nsp.create`, default on) allows in-namespace ingress on 6379 for default-deny
  namespaces.

## Security / trust model

This deploys Valkey with **no `requirepass` and no TLS**, and the NetworkPolicy admits **any pod in
the namespace**. The per-release key prefix is collision-avoidance, **not** an isolation boundary:
any pod that can reach Valkey can read or overwrite another release's cached values. This is only
safe when the namespace is a **single trust domain** (a dedicated env namespace, or PR namespaces
owned by the same team), which is the assumption on the target OpenShift platform.

If a namespace ever becomes multi-tenant, enable `requirepass` (and TLS), which means moving
`PLUGIN_CACHE_REDIS_URL` out of the backend ConfigMap into a Secret — a coordinated change, not a
values tweak — and/or run a dedicated Valkey per trust domain.
