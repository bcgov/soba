import { workflowEnginePluginDefinition } from '../../../src/plugins/cs-workflow-v1';
import { CsWorkflowEngineAdapter } from '../../../src/plugins/cs-workflow-v1/csWorkflowEngineAdapter';
import {
  createPluginConfigReaderFrom,
  type PluginConfigReader,
} from '../../../src/core/config/pluginConfig';
import { createEnvReader } from '../../../src/core/config/env';

import {
  json,
  startCsWorkflow,
  type CsWorkflowHandler,
  type FakeCsWorkflow,
} from './fakeCsWorkflow';

function makeConfig(values: Record<string, string>): PluginConfigReader {
  return createPluginConfigReaderFrom(
    createEnvReader(
      Object.fromEntries(
        Object.entries(values).map(([key, value]) => [`PLUGIN_CS_WORKFLOW_V1_${key}`, value]),
      ),
    ),
    'cs-workflow-v1',
  );
}

// What a base URL missing /api reaches: the frontend, which answers every path with 200 HTML.
const frontendPage: CsWorkflowHandler = (_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end('<!doctype html><p>Connected Services</p>');
};

describe('cs-workflow-v1 plugin', () => {
  let api: FakeCsWorkflow | undefined;
  afterEach(async () => {
    await api?.close();
    api = undefined;
    jest.restoreAllMocks();
  });

  it('declares the expected definition', () => {
    expect(workflowEnginePluginDefinition.code).toBe('cs-workflow-v1');
    expect(workflowEnginePluginDefinition.metadata).toEqual({
      code: 'cs-workflow-v1',
      name: 'Connected Services Workflow',
      version: 'v1',
    });
  });

  it('requires the API base URL', () => {
    expect(() => new CsWorkflowEngineAdapter(makeConfig({}))).toThrow(
      'PLUGIN_CS_WORKFLOW_V1_API_BASE_URL is required',
    );
  });

  it('readinessCheck is ok when health answers with its JSON body', async () => {
    api = await startCsWorkflow(json(200, { data: [] }));
    const adapter = new CsWorkflowEngineAdapter(
      makeConfig({ API_BASE_URL: api.baseUrl, API_KEY: 'test-key' }),
    );

    await expect(adapter.readinessCheck()).resolves.toEqual({ ok: true });
    expect(api.requests[0]).toEqual({
      method: 'GET',
      url: '/api/v1/workflows',
      authorization: undefined,
      body: undefined,
    });
  });

  it('readinessCheck is not ok when the base URL reaches the frontend', async () => {
    api = await startCsWorkflow(frontendPage);
    const adapter = new CsWorkflowEngineAdapter(
      makeConfig({ API_BASE_URL: api.baseUrl, API_KEY: 'test-key' }),
    );

    await expect(adapter.readinessCheck()).resolves.toEqual({
      ok: false,
      message: 'Unexpected Connected Services Workflow health response',
    });
  });

  it('readinessCheck is not ok when the API is unreachable', async () => {
    api = await startCsWorkflow(json(200, {}));
    const { baseUrl } = api;
    await api.close();
    api = undefined;
    const adapter = new CsWorkflowEngineAdapter(
      makeConfig({ API_BASE_URL: baseUrl, API_KEY: 'test-key' }),
    );

    const result = await adapter.readinessCheck();
    expect(result.ok).toBe(false);
  });

  it('workflows is ok when n8n answers with its JSON body', async () => {
    api = await startCsWorkflow(json(200, { data: [] }));
    const adapter = new CsWorkflowEngineAdapter(
      makeConfig({ API_BASE_URL: api.baseUrl, API_KEY: 'test-key' }),
    );

    await expect(adapter.getWorkflows()).resolves.toEqual({ workflows: [] });
    expect(api.requests[0]).toEqual({
      method: 'GET',
      url: '/api/v1/workflows',
      authorization: undefined,
      body: undefined,
    });
  });

  it('workflow is ok when n8n answers with its JSON body', async () => {
    api = await startCsWorkflow(json(200, { data: { workflow: {} } }));
    const adapter = new CsWorkflowEngineAdapter(
      makeConfig({ API_BASE_URL: api.baseUrl, API_KEY: 'test-key' }),
    );

    await expect(adapter.getWorkflow('123')).resolves.toEqual({ workflow: {} });
    expect(api.requests[0]).toEqual({
      method: 'GET',
      url: '/api/v1/workflow/123',
      authorization: undefined,
      body: undefined,
    });
  });
});
