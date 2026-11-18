# External API versioning options

This document compares three ways to version the CHEFS2 integration API.

## What stays the same

- Releases use semantic versions such as `1.2.3`: `1` is the major, `2` is the minor and `3` is
  the patch. Fixes that keep existing integrations working change the patch. New features that
  keep them working change the minor. Breaking changes require a new major.
- Public URLs and backend paths can differ. These examples use public `/api/...` URLs and
  backend `/chefs/integration/...` paths, updating the examples in the earlier design document.
- The gateway checks API keys. The backend checks that the request really came through the
  gateway, then checks which forms and data that key may access.
- We can choose release numbers, the versions clients can request and how many deployments to
  run separately. A separate deployment means another running set of backend pods. We could
  have one per major or minor; we do not need one for every patch.

An **API contract** means the requests an API accepts, the responses it returns and the behavior
clients can rely on. Keeping an older version available means continuing to support that contract.

## Summary, pros and cons

| Approach                                                | Summary                                                                                                                                                                                                   | Pros                                                                                                                                                                                                 | Cons                                                                                                                                                                                                                        | Best fit                                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **1. Major versions in URLs**                           | Clients call `/api/v1`. Releases such as `1.1.0` and `1.2.0` update it while keeping existing integrations working. Breaking changes introduce `/api/v2`. Supported majors run in one backend deployment. | Fewer versions to maintain; security fixes can be shared; clients receive compatible improvements automatically; simpler routing and releases.                                                       | Clients cannot stay on a specific minor; updates must keep existing integrations working; shared code and database changes must work for every supported major; versions deploy and scale together.                         | Clients need a stable API but do not need to choose a minor version.            |
| **2. Major and minor versions in URLs, one deployment** | Clients choose `/api/v1.1` or `/api/v1.2`. `/api/v1` points to the latest approved minor. One backend deployment runs all supported versions.                                                             | Clients choose when to move to a newer minor; another version does not automatically need more pods; permissions and other code can be shared; clients can use `/api/v1` to follow the latest minor. | Every minor needs ongoing support and tests; shared changes can affect older versions; all versions deploy and scale together; different behavior may require more code; gateway changes must be coordinated with releases. | HMA or other clients need to stay on a specific minor while trying a newer one. |
| **3. Separate deployments for each supported version**  | Each supported major or minor runs in its own backend deployment. The gateway sends requests to the right deployment.                                                                                     | Release, roll back and scale each version separately; a crash in one version's process does not crash the others; versions can use different dependencies or implementations.                        | More pods, resources and database connections; more deployments to manage; fixes may need to be applied to older code too; more complex releases and routing; shared databases and services still connect the versions.     | Versions need different runtime setups or must be released independently.       |

## How each approach would look

| Detail                        | 1. Major URLs                                                                             | 2. Minor URLs, one deployment                                                                                             | 3. Separate deployments                                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Public URLs                   | `/api/v1`, `/api/v2`                                                                      | `/api/v1`, `/api/v1.1`, `/api/v1.2`                                                                                       | Major or minor URLs, depending on what we agree to support                                                                  |
| Gateway destination           | `/api/v1` → backend `/chefs/integration/v1`                                               | `/api/v1` and `/api/v1.2` → backend `/chefs/integration/v1.2`; `/api/v1.1` keeps its own route                            | `/api/v1.1` → `integration-v1-1` service; `/api/v1.2` → `integration-v1-2` service                                          |
| Code folders                  | One per supported major                                                                   | One per supported minor where behavior differs                                                                            | Separate apps or maintained release branches for each deployment                                                            |
| Services and database queries | Share code where behavior matches; separate it where majors differ                        | Share code where behavior matches; separate it where minors differ                                                        | Share libraries where useful; apply fixes to every affected deployment                                                      |
| CI/CD                         | Test all supported majors, deploy one backend image and update gateway routes when needed | Test all supported minors, deploy one backend image, then update where `/api/v1` points                                   | Build, test and release each version separately; record which image each gateway route uses and what to restore if it fails |
| Database changes              | Must keep every supported major working                                                   | Must keep every supported minor working                                                                                   | Must keep every supported deployment working, including older images                                                        |
| Rolling back a release        | Restoring an older backend image affects all versions in that deployment                  | `/api/v1` can point back to an older minor that is still available; restoring an older backend image affects all versions | Restore one deployment or change its gateway route separately                                                               |
| Ending support                | Remove the major after clients have had the agreed time to move                           | Remove the minor's public route and code after the agreed support period                                                  | Remove the public route and deployment after the agreed support period                                                      |

Example folder structures for approaches 1 and 2:

```text
# Approach 1: one deployment, folders per major
integration/
  middleware/
  shared/
  v1/
    routes.ts
    schema.ts
    exportService.ts
  v2/
    routes.ts
    schema.ts
    exportService.ts

# Approach 2: one deployment, folders per minor
integration/
  middleware/
  shared/
    exportService.ts
  v1.1/
    routes.ts
    schema.ts
    response.ts
  v1.2/
    routes.ts
    schema.ts
    response.ts
    exportService.ts  # Only if this version needs different behavior
```

Share code when it works for both versions. If the versions need different behavior, create a
separate handler, service or database query for that part. There is no need to copy the whole
backend. Tests must confirm that older versions still work as promised; putting code in a version
folder does not guarantee that. Apply security fixes to every supported version, including copied code.

## OpenShift resource use

Approaches 1 and 2 use the same set of backend pods for all versions. Adding a version does not
automatically need more pods, although more traffic or larger exports may need more resources.
Approach 3 runs another set of pods for each separately deployed version.

For example, the current [production backend settings](../deployments/helm/soba/values-prod.yaml)
run 3–6 replicas (copies of the backend). Each requests 250m CPU and 512Mi memory, with limits of
1 CPU and 1Gi memory. Another deployment using these settings would add:

| Additional deployment size   | Additional pods | CPU requests | Memory requests | CPU limits | Memory limits |
| ---------------------------- | --------------- | ------------ | --------------- | ---------- | ------------- |
| At the minimum of 3 replicas | 3               | 0.75 cores   | 1.5Gi           | 3 cores    | 3Gi           |
| At the maximum of 6 replicas | 6               | 1.5 cores    | 3Gi             | 6 cores    | 6Gi           |

These numbers come from the settings; they do not show actual usage or prove what the integration
API needs. We also need room for extra pods during updates and for supporting jobs. If our
namespace quota caps total requests or limits, even idle deployments count towards that cap; see
[Kubernetes resource quotas](https://kubernetes.io/docs/concepts/policy/resource-quotas/).
Deploying the whole Helm chart again could also create another frontend and supporting services.
Separate API versions should deploy only the backend resources they need.

We have not checked the namespace's actual limits or usage because the workspace had no active
OpenShift connection during the investigation. Before choosing separate deployments, check the
remaining quota, maximum pod counts under autoscaling, room for pods during updates and available
database connections.

## Suggested direction

Start with **approach 1** if clients need a stable API without choosing a minor version. Choose
**approach 2** if clients must be able to stay on a specific minor; this supports the original
`/v2` and `/v2.1` idea without adding a deployment for each version.

Use **approach 3** when versions need to run or be released separately, such as while moving
clients to a substantially different major version. For any approach, agree on how long we will
support each version and how clients will move off it before making the URLs available.
