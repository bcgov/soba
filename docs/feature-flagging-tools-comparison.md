# Feature Flagging Tools Comparison

> Tool comparison reference: [Best Feature Flagging Tools — Statsig](https://www.statsig.com/comparison/best-feature-flagging-tools)

**Tools:**
· [Unleash](https://www.getunleash.io)
· [GrowthBook](https://www.growthbook.io)
· [Flagsmith](https://www.flagsmith.com)
· [PostHog](https://posthog.com)
· [LaunchDarkly](https://launchdarkly.com)
· [Statsig](https://www.statsig.com)
· [Split.io](https://www.split.io)
· [ConfigCat](https://configcat.com)

## Current State

The project already has two layers of feature flagging:

| Layer | Implementation |Gap
| **Backend** | `soba.feature` + `soba.feature_status` DB tables | Already solid |
| **Frontend** | `NEXT_PUBLIC_FEATURE_FLAGS` / `NEXT_PUBLIC_DISABLED_FEATURE_FLAGS` env vars | Known gap: should come from `GET /meta/features`, not env |

The known gap: frontend flags currently come from environment variables and should instead come from the backend `GET /meta/features` endpoint as the single source of truth.

---

## When to Add an External Tool

**Stick with the custom system if you need:**

- Simple on/off per environment
- Flags tied to the DB schema, roles, or plugins
- No extra infrastructure

**Add an external tool if you need:**

- Gradual rollouts (% of users)
- User/group targeting (e.g., only IDIR users in a specific ministry)
- A UI for non-developers to toggle flags
- Audit logs of flag changes
- A/B testing

---

## Tool Evaluation

Evaluated against key soba constraints: OpenShift (BC Gov Silver cluster), data residency (data must stay in BC Gov infrastructure), Node.js + TypeScript backend, Next.js frontend, Helm-based deployment, PostgreSQL already in stack.

| Tool             | Self-Host       | Node SDK | React SDK | Open Source      | Helm Chart | BC Gov Fit                 |
| ---------------- | --------------- | -------- | --------- | ---------------- | ---------- | -------------------------- |
| **Unleash**      | Yes             | Yes      | Yes       | Yes (Apache 2.0) | Yes        | Best                       |
| **GrowthBook**   | Yes             | Yes      | Yes       | Yes (MIT)        | Yes        | Excellent                  |
| **Flagsmith**    | Yes             | Yes      | Yes       | Yes              | Yes        | Good                       |
| **PostHog**      | Yes             | Yes      | Yes       | Yes              | Yes        | Heavy (analytics platform) |
| **LaunchDarkly** | Enterprise only | Yes      | Yes       | No               | No         | SaaS/costly                |
| **Statsig**      | Limited         | Yes      | Yes       | Partial          | No         | SaaS-first                 |
| **Split.io**     | No              | Yes      | Yes       | No               | No         | SaaS only                  |
| **ConfigCat**    | No              | Yes      | Yes       | No               | No         | SaaS only                  |

### Pros and Cons

**[Unleash](https://www.getunleash.io)**

- Pros:
  - Reuses existing Postgres — no new database to provision in the OpenShift namespace
  - Official Helm chart slots directly into the existing soba Helm deployment
  - `@unleash/nextjs` has first-class Next.js support (server-side flag evaluation out of the box)
  - Variants allow targeting by IDIR/BCeID identity provider or ministry role, both already available in the JWT
  - Apache 2.0 meets BC Gov open source requirements
- Cons:
  - Adds a new service pod — counts against OpenShift resource quota
  - No built-in stats engine — experiment outcomes need to be tracked separately
  - Creates a second source of truth alongside the existing `soba.feature` table until a migration is done

**[GrowthBook](https://www.growthbook.io)**

- Pros:
  - Reuses existing MongoDB (Form.io) — no new database needed
  - Built-in stats engine — useful if the team moves toward UX A/B testing without a separate analytics tool
  - Can connect directly to existing Postgres as a data source for experiment metrics
  - MIT license meets BC Gov open source requirements
- Cons:
  - OSS version lacks per-environment SDK keys — complicates managing dev/test/prod separation across OpenShift namespaces
  - Feature flag management (strategies, audit logs) is less mature than Unleash
  - Smaller community; fewer examples from government or similar regulated environments

**[Flagsmith](https://www.flagsmith.com)**

- Pros:
  - Self-hostable with a Helm chart; stays within BC Gov infrastructure
  - Simpler to set up than Unleash
- Cons:
  - No native Next.js SDK — requires custom integration work
  - Fewer targeting strategies; segmenting by IDIR vs BCeID or by ministry needs workarounds
  - Less adoption in enterprise/government contexts — harder to find precedents

**[PostHog](https://posthog.com)**

- Pros:
  - Could consolidate analytics and feature flags into one self-hosted tool
- Cons:
  - Significantly resource-heavy — would strain the OpenShift Silver cluster resource quotas
  - Overkill for the current need; brings in a full analytics platform the project doesn't use
  - Much more operational overhead than the rest of the stack warrants

**[LaunchDarkly](https://launchdarkly.com)**

- Pros:
  - Best-in-class SDK quality and targeting capabilities
- Cons:
  - SaaS only — user and flag data leaves BC Gov infrastructure, violating data residency requirements
  - Enterprise pricing is not viable for a BC Gov project
  - Ruled out

**[Statsig](https://www.statsig.com)**

- Pros:
  - Strong experimentation and A/B testing features
- Cons:
  - SaaS-first — meaningful self-hosting is not available; data residency not met
  - Partial open source; doesn't align with BC Gov open source preference
  - Ruled out

**[Split.io](https://www.split.io)**

- Pros:
  - Mature feature flagging and experimentation product
- Cons:
  - SaaS only — no self-hosting; data residency requirement not met
  - Proprietary
  - Ruled out

**[ConfigCat](https://configcat.com)**

- Pros:
  - Simple API, low learning curve, clean SDKs
- Cons:
  - SaaS only — data residency requirement not met
  - Targeting limited to basic user attributes; IDIR/BCeID or ministry-based segmentation would require workarounds
  - Ruled out

---

## Recommendation: Unleash

### Why Unleash Fits soba

1. **Data residency** — 100% self-hosted; no data leaves the OpenShift cluster
2. **PostgreSQL backend** — uses the same Postgres already in the Helm chart; no new database needed
3. **Helm chart available** — official `unleash/unleash-helm-charts`, drops in alongside the existing soba chart
4. **SDKs match the stack** — `unleash-client` for the Express backend, `@unleash/nextjs` for the Next.js frontend
5. **OpenShift compatible** — standard container, no root privileges required
6. **Open source (Apache 2.0)** — aligns with BC Gov open source preference
7. **Mature and production-ready** — v5, used by large organizations including governments

### Quick Integration Examples

**Backend (Node.js):**

```typescript
import { initialize } from "unleash-client";

const unleash = initialize({
  url: "http://unleash:4242/api",
  appName: "soba",
  customHeaders: { Authorization: "*:development.<secret>" },
});

const isEnabled = unleash.isEnabled("my-feature");
```

**Frontend (Next.js):**

```typescript
import { FlagProvider } from "@unleash/nextjs";

// Wrap your Next.js app — flags evaluated server-side
export default function App({ Component, pageProps }) {
  return (
    <FlagProvider
      config={{ url: "/api/proxy/unleash", clientKey: "...", appName: "soba" }}
    >
      <Component {...pageProps} />
    </FlagProvider>
  );
}
```

### Runner-up: GrowthBook

If simpler setup with less infrastructure overhead is preferred, GrowthBook is an excellent alternative — MIT licensed, supports MongoDB (already in the stack for Form.io), and has a clean React SDK. Better suited if A/B testing is a priority.

#### Why GrowthBook Fits soba

1. **Data residency** — fully self-hosted; no data leaves the OpenShift cluster
2. **MongoDB backend** — uses the same MongoDB already in the stack for Form.io; no new database needed
3. **Helm chart available** — official GrowthBook Helm chart deploys alongside the existing soba chart
4. **SDKs match the stack** — `@growthbook/growthbook` for the Express backend, `@growthbook/growthbook-react` for the Next.js frontend
5. **OpenShift compatible** — standard container, no root privileges required
6. **Open source (MIT)** — aligns with BC Gov open source preference
7. **Built-in experiment engine** — statistical analysis and a visual experiment editor included; no external analytics tool needed for basic A/B testing

#### Quick Integration Examples

**Backend (Node.js):**

```typescript
import { GrowthBook } from "@growthbook/growthbook";

const gb = new GrowthBook({
  apiHost: "http://growthbook:3100",
  clientKey: process.env.GROWTHBOOK_CLIENT_KEY,
});

await gb.loadFeatures();

const isEnabled = gb.isOn("my-feature");
```

**Frontend (Next.js):**

```typescript
import { GrowthBookProvider } from "@growthbook/growthbook-react";

export default function App({ Component, pageProps }) {
  return (
    <GrowthBookProvider growthbook={gb}>
      <Component {...pageProps} />
    </GrowthBookProvider>
  );
}
```

---

## Recommended Architecture

The cleanest path given the existing system:

```
soba.feature table           → Keep for core system features (form-versions, submissions, meta)
Unleash (self-hosted)        → Use for new product/UX flags needing targeting or gradual rollout
GET /meta/features endpoint  → Proxy both sources, closing the frontend/backend gap
```

This avoids a full rewrite while gaining a proper feature flag UI and targeting capabilities.

---

## Future: UX A/B Testing

When the team wants to test two different UX approaches (e.g., two form layouts, two navigation patterns), these tools can support that workflow:

- **Unleash** supports [variants](https://docs.getunleash.io/reference/feature-toggle-variants) — a feature toggle can deliver variant A to one user cohort and variant B to another, with stable assignment (same user always sees the same variant). Targeting can be based on any user context property (ministry, identity provider, role).
- **GrowthBook** is purpose-built for this — it has a built-in experiment runner with statistical analysis and a visual experiment editor for non-developers. If UX experimentation becomes a recurring need, GrowthBook is worth revisiting over Unleash (see runner-up note above).

In both cases, the tools handle _which users see which variant_. Collecting user feedback or measuring outcomes still requires a separate mechanism (analytics events, surveys, etc.) tied to the variant assignment.
