import type { PluginConfigReader } from '../../core/config/pluginConfig';
import type { WorkflowEngineAdapter } from '../../core/integrations/workflow/WorkflowEngineAdapter';
import type { WorkflowEnginePluginDefinition } from '../../core/integrations/workflow/WorkflowEnginePluginDefinition';

const CODE = 'workflow-noop';

/** No-op workflow engine: starts nothing and knows no instances, no external call. */
function createNoopWorkflowEngineAdapter(config: PluginConfigReader): WorkflowEngineAdapter {
  config = null; // unused, but required by the interface
  return {
    readinessCheck: () => Promise.resolve({ ok: true }),
    getWorkflows: () => Promise.resolve({ workflows: [] }),
    getWorkflow: (workflowId: string) => Promise.resolve({ id: workflowId }),
    startWorkflow: () => Promise.resolve(false),
  };
}

export const workflowEnginePluginDefinition: WorkflowEnginePluginDefinition = {
  code: CODE,
  metadata: {
    code: CODE,
    name: 'No-op workflow engine',
  },
  createAdapter: createNoopWorkflowEngineAdapter,
};
