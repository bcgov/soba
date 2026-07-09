# Creating External Service Plugins/Integrations

This guide explains how to create a new plugin that integrates with an external service that optionally requires authentication.

## Architecture Layers

### 1. Generic Token Provider (`core/auth/tokenProvider.ts`)

**Purpose:** Define an abstract contract for token providers.

**Key Classes:**

- `TokenProvider` — interface that any token provider must implement
- `NoOpTokenProvider` — returns null (for unauthenticated requests)
- `StaticTokenProvider` — returns a hardcoded token (for testing)

This abstraction allows swapping different auth mechanisms without changing the HTTP client code.

### 2. OAuth2 Token Provider (`core/auth/oauth2TokenProvider.ts`)

**Purpose:** Handle OAuth2 client-credentials token management with caching.

**Key Features:**

- `OAuth2TokenProvider` — implements TokenProvider for OAuth2
- Token caching with configurable expiry buffer
- Per-service token cache (supports multiple services)
- Errors are caught and logged
- Factory function: `createOAuth2TokenProvider(config)`

**Usage:**

```typescript
import {
  createOAuth2TokenProvider,
  type OAuth2Config,
} from "@/core/auth/oauth2TokenProvider";

const tokenConfig: OAuth2Config = {
  tokenUrl: "https://sso.example.com/token",
  clientId: "my-client",
  clientSecret: "my-secret",
};

// Returns () => Promise<string | null>
const tokenProvider = createOAuth2TokenProvider(tokenConfig);
```

### 3. Generic HTTP Client (`core/clients/httpClient.ts`)

**Purpose:** Provide a reusable HTTP client for calling external services with optional auth.

**Key Features:**

- Optional Bearer token injection
- Automatic JSON serialization/deserialization
- Error wrapping in `HttpClientError`
- Support for `FormData` (for multipart requests)
- Logging and debugging

**Usage:**

```typescript
import { HttpClient } from "@/core/clients/httpClient";

// Without auth
const client = new HttpClient({ baseUrl: "https://api.example.com" });

// With token provider
const client = new HttpClient({
  baseUrl: "https://api.example.com",
  getToken: tokenProvider,
});

// Make requests
const data = await client.get("/endpoint");
await client.post("/endpoint", { key: "value" });
```

### 4. Service-Specific Client

Each external service gets a custom client that extends or composes the generic `HttpClient`.

**Example:** CDOGS Client

```typescript
import { HttpClient, HttpClientError } from "@/core/clients/httpClient";

export class CdogsApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`CDOGS ${status}: ${body}`);
    this.status = status;
    this.body = body;
  }

  static from(err: HttpClientError): CdogsApiError {
    return new CdogsApiError(err.status, err.body);
  }
}

export class CdogsClient {
  private readonly client: HttpClient;

  constructor(options: {
    baseUrl: string;
    getToken?: () => Promise<string | null>;
  }) {
    this.client = new HttpClient({
      baseUrl: options.baseUrl,
      getToken: options.getToken,
    });
  }

  async uploadTemplate(
    version: "v2" | "v3",
    file: Buffer,
    filename: string,
  ): Promise<string> {
    try {
      const formData = new FormData();
      formData.append("template", new Blob([new Uint8Array(file)]), filename);

      const res = await this.client.rawRequest(`/api/${version}/template`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new CdogsApiError(res.status, await res.text());
      }

      return res.headers.get("X-Template-Hash") || (await res.text());
    } catch (err) {
      if (err instanceof HttpClientError) {
        throw CdogsApiError.from(err);
      }
      throw err;
    }
  }
}
```

### 5. Plugin Factory

Create a factory function that wires everything together using `PluginConfigReader`.

```typescript
import { PluginConfigReader } from "@/core/config/pluginConfig";
import {
  OAuth2Config,
  createOAuth2TokenProvider,
} from "@/core/auth/oauth2TokenProvider";

export function createMyServiceClient(
  pluginConfig: PluginConfigReader,
): MyServiceClient {
  // Read config
  const tokenUrl = pluginConfig.getOptional("TOKEN_URL");
  const clientId = pluginConfig.getOptional("CLIENT_ID");
  const clientSecret = pluginConfig.getOptional("CLIENT_SECRET");

  // Create token provider if auth is configured
  let tokenProvider: (() => Promise<string | null>) | undefined;
  if (tokenUrl && clientId && clientSecret) {
    const config: OAuth2Config = { tokenUrl, clientId, clientSecret };
    tokenProvider = createOAuth2TokenProvider(config);
  }

  return new MyServiceClient({
    baseUrl: pluginConfig.getRequired("BASE_URL"),
    getToken: tokenProvider,
  });
}
```

## Step-by-Step: Creating a New Plugin

### Step 1: Define the Service Adapter Interface

Create `backend/src/core/integrations/{service}/adapter.ts` with the core abstraction:

```typescript
export interface MyServiceAdapter {
  readonly supportedVersions: string[];

  async doSomething(version: string, input: MyInput): Promise<MyOutput>;
  // ... other methods
}
```

### Step 2: Create the HTTP Client

Create `backend/src/plugins/{service}/{service}Client.ts`:

- Extend or compose `HttpClient`
- Wrap errors in service-specific error class (extends `Error`)
- Implement service-specific methods (correspond to API endpoints)

### Step 3: Create the Adapter Implementation

Create `backend/src/plugins/{service}/{service}Adapter.ts`:

```typescript
import { MyServiceAdapter } from "@/core/integrations/{service}/adapter";
import { MyServiceClient } from "./{service}Client";

export class MyServiceAdapterImpl implements MyServiceAdapter {
  readonly supportedVersions = ["v1", "v2"];
  private client: MyServiceClient;

  constructor(client: MyServiceClient) {
    this.client = client;
  }

  async doSomething(version: string, input: MyInput): Promise<MyOutput> {
    if (!this.supportedVersions.includes(version)) {
      throw new Error(`Unsupported version: ${version}`);
    }
    return this.client.doSomething(version, input);
  }
}
```

### Step 4: Create Routes

Create `backend/src/plugins/{service}/{service}Routes.ts`:

```typescript
import { Router, Request, Response } from "express";
import { PluginConfigReader } from "@/core/config/pluginConfig";
import { ValidationError } from "@/core/errors";
import { MyServiceAdapter } from "./adapter";
import { myRequestSchema } from "./schema";

export function createMyServiceRouter(config: PluginConfigReader): Router {
  const router = Router();
  const adapter = new MyServiceAdapter(createMyServiceClient(config));

  router.post("/:version/action", async (req: Request, res: Response, next) => {
    try {
      const parsed = myRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.message);
      }

      const result = await adapter.doSomething(req.params.version, parsed.data);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

### Step 5: Create Plugin Definition

Create `backend/src/plugins/{service}/index.ts`:

```typescript
import { PluginConfigReader } from "@/core/config/pluginConfig";
import { FeatureApiDefinition } from "@/core/integrations/plugins/FeatureApiDefinition";
import { createMyServiceRouter } from "./{service}Routes";

export const pluginApiDefinition: FeatureApiDefinition = {
  code: "my-service",
  basePath: "/my-service",
  createRouter: (config: PluginConfigReader) => createMyServiceRouter(config),
};
```

### Step 6: Configure Environment

Add to `backend/.env.example`:

```env
# My Service Plugin
PLUGIN_MY_SERVICE_BASE_URL=https://api.example.com

# Authentication (optional)
PLUGIN_MY_SERVICE_TOKEN_URL=https://sso.example.com/token
PLUGIN_MY_SERVICE_CLIENT_ID=...
PLUGIN_MY_SERVICE_CLIENT_SECRET=...
```

### Step 7: Seed Feature Flag

Create migration `backend/drizzle/NNNN_seed_my_service_feature.sql`:

```sql
INSERT INTO soba.feature (id, code, name, description, status, created_by, updated_by, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'my-service',
  'My Service',
  'Integration with My Service API',
  'enabled',
  'SOBA System (seed)',
  'SOBA System (seed)',
  NOW(),
  NOW()
);
```

### Step 8: Add Frontend Feature Code

In `frontend/src/shared/featureFlags/flags.ts`:

```typescript
export const FEATURE_CODES = {
  // ... existing features
  MY_SERVICE: "my-service",
} as const;
```

### Step 9: Test

Create `backend/tests/plugins/{service}/` with unit tests:

- HTTP client tests (mock fetch)
- Route validation tests
- Error handling tests

Run: `npm test -- tests/plugins/{service}/`

## Optional Authentication Pattern

When auth is optional (like CDOGS), the pattern is:

1. **Factory checks config completeness:** If any auth key is missing, `tokenProvider = undefined`
2. **HttpClient checks token provider:** Before each request, if `getToken` exists, call it
3. **Token provider can return `null`:** If token fetch fails, return `null` (caller must handle)
4. **HttpClient omits auth header if token is `null`:** Results in unauthenticated request

This allows plugins to gracefully degrade:

- Development: All requests unauthenticated
- Production: Auth enabled by setting env vars

## Configuration Best Practices

1. **Always use `PluginConfigReader`:** Scopes env vars to `PLUGIN_{CODE}_*`
2. **Check completeness before creating token provider:** Don't create provider if config incomplete
3. **Wrap token provider errors:** Log but return `null` to allow fallback
4. **Version the API:** Accept `/:version/*` in routes for v1/v2 upgrades
5. **Validate requests with Zod:** Use schemas in `schema.ts` for consistency
6. **Create custom error class:** Extend `Error`, wrap `HttpClientError` for service-specific context

## FAQ

**Q: What if the external service doesn't use OAuth2?**

A: Skip `oauth2TokenProvider`. Pass a different `getToken` function or omit it entirely (for unauthenticated or API-key based auth).

**Q: How do I test the client?**

A: Mock `fetch` at the test level:

```typescript
global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify(...)));
```
