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

const WorkflowsResponseSchema = z.object({ data: z.array(z.object()) });
const WorkflowResponseSchema = z.object({ data: z.object() });

/** Connected Services workflows, started and read with the caller's own token. */
export class CsWorkflowEngineAdapter implements WorkflowEngineAdapter {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly apiKey: string;

  constructor(config: PluginConfigReader) {
    this.baseUrl = config.getRequired('API_BASE_URL');
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

  async getWorkflows(): Promise<GetWorkflowsResult> {
    const res = await this.request('GET', WORKFLOWS_PATH);
    const body: unknown = await res.json().catch(() => undefined);
    const safeParseResult = WorkflowsResponseSchema.safeParse(body);
    if (!safeParseResult.data) {
      throw new Error(`Unexpected ${SERVICE} workflows response`);
    }
    return { workflows: safeParseResult.data.data as Array<Workflow> };
  }

  async getWorkflow(id: string): Promise<Workflow> {
    const res = await this.request('GET', `${WORKFLOW_PATH}/${id}`);
    const body: unknown = await res.json().catch(() => undefined);
    const safeParseResult = WorkflowResponseSchema.safeParse(body);
    if (!safeParseResult.data) {
      throw new Error(JSON.stringify(safeParseResult));
    }
    return { workflow: safeParseResult.data.data as Workflow };
  }

  // IMPORTANT!!
  // TODO: This isn't actually how you would kick off a workflow in n8n. You have to get the workflow,
  // find out how it's triggered and then trigger it. So it'll require some finesse on our end
  // IMPORTANT!!
  async startWorkflow(id: string, payload: object): Promise<boolean> {
    const res = await this.request('GET', `${WORKFLOW_PATH}/${id}`, payload);
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
  ): Promise<Response> {
    const url = joinUrl(this.baseUrl, path);
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
