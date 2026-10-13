import { z } from 'zod';
import type { PluginConfigReader } from '../../core/config/pluginConfig';
import type {
  WorkflowEngineAdapter,
  WorkflowEngineReadinessResult,
  GetWorkflowsResult,
  Workflow,
} from '../../core/integrations/workflow/WorkflowEngineAdapter';
import { HttpClientError, joinUrl, resolveTimeoutMs } from '../../core/http/httpClient';

const SERVICE = 'Connected Services Workflow';
const WORKFLOWS_PATH = 'workflows';
const WORKFLOW_PATH = 'workflow';

const WorkflowsResponseSchema = z.object({ data: z.array(z.object().loose()) });
const WorkflowResponseSchema = z.object({ data: z.object().loose() });

/** Connected Services workflows, started and read with the caller's own token. */
export class CsWorkflowEngineAdapter implements WorkflowEngineAdapter {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly apiKey: string;
  private readonly baseUrlWithoutApi: string;

  constructor(config: PluginConfigReader) {
    this.baseUrl = config.getRequired('API_BASE_URL');
    this.baseUrlWithoutApi = this.baseUrl.replace(/^\/*api\/v\d+\/*/, '');
    this.timeoutMs = resolveTimeoutMs(
      config.getOptionalNumber('TIMEOUT_MS'),
      'PLUGIN_CS_WORKFLOW_V1_TIMEOUT_MS',
    );
    this.apiKey = config.getRequired('API_KEY');
  }

  // N8n does'n have a health endpoint, so we just check that we can get the workflows list.
  async readinessCheck(): Promise<WorkflowEngineReadinessResult> {
    try {
      const res = await this.request('GET', WORKFLOWS_PATH);
      const body: unknown = await res.json().catch(() => undefined);
      if (!WorkflowsResponseSchema.safeParse(body).data) {
        return { ok: false, message: `Unexpected ${SERVICE} health response` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async getWorkflows(name?: string): Promise<GetWorkflowsResult> {
    const url = WORKFLOWS_PATH + (name ? `?name=${encodeURIComponent(name)}` : '');
    const res = await this.request('GET', url);
    const body: unknown = await res.json().catch(() => undefined);
    const safeParseResult = WorkflowsResponseSchema.safeParse(body);
    if (!safeParseResult.data) {
      throw new Error(`Unexpected ${SERVICE} workflows response`);
    }
    return { workflows: safeParseResult.data.data as unknown as Array<Workflow> };
  }

  async getWorkflow(id: string): Promise<Workflow> {
    const res = await this.request('GET', `${WORKFLOW_PATH}/${id}`);
    const body: unknown = await res.json().catch(() => undefined);
    const safeParseResult = WorkflowResponseSchema.safeParse(body);
    if (!safeParseResult.data) {
      throw new Error(JSON.stringify(safeParseResult));
    }
    return { id: safeParseResult.data.data.id as string };
  }

  async startWorkflow(id: string, payload: object): Promise<boolean> {
    const workflow = await this.getWorkflow(id);
    //the
    const path =
      (workflow as unknown as Record<string, unknown>).node?.[0]?.parameters?.path ?? null;
    if (!path) {
      throw new Error(`Workflow ${id} does not have a path parameter`);
    }
    const res = await this.request('GET', `webhook/${path}`, payload, true);
    const body: unknown = await res.json().catch(() => undefined);
    const safeParseResult = WorkflowsResponseSchema.safeParse(body);
    if (!safeParseResult.data) {
      throw new Error(`Unexpected ${SERVICE} workflows response`);
    }
    return true;
  }

  /** Request under the base URL; a non-2xx response throws HttpClientError. */
  private async request(
    method: 'GET' | 'POST',
    path: string,
    payload?: unknown,
    withoutApi = false,
  ): Promise<Response> {
    const url = joinUrl(withoutApi ? this.baseUrlWithoutApi : this.baseUrl, path);
    const headers: Record<string, string> = {};
    if (this.apiKey) headers['X-N8N-API-KEY'] = this.apiKey;
    if (payload !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
      method,
      headers,
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new HttpClientError(res.status, res.statusText, text, url);
    }
    return res;
  }
}
