import type { PluginConfigReader } from '../../core/config/pluginConfig';
import type { WorkflowEngineAdapter } from '../../core/integrations/workflow/WorkflowEngineAdapter';
import type { WorkflowEnginePluginDefinition } from '../../core/integrations/workflow/WorkflowEnginePluginDefinition';

const CODE = 'workflow-noop';

/** No-op workflow engine: starts nothing and knows no instances, no external call. */
function createNoopWorkflowEngineAdapter(config: PluginConfigReader): WorkflowEngineAdapter {
  void config; // Required by interface; this plugin does not use config
  return {
    readinessCheck: async () => ({ ok: true }),
    getWorkflows: async () => ({ workflows: [] }),
    getWorkflow: async (workflowId: string) => ({ id: workflowId }),
    startWorkflow: async () => false,
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
