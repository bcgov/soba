import {
  FormEngineAdapter,
  FormVersionProvisionInput,
  SubmissionProvisionInput,
} from '../../core/integrations/form-engine/FormEngineAdapter';
import { PluginConfigReader } from '../../core/config/pluginConfig';

const placeholderRef = (prefix: string, id: string) => `${prefix}-${id}`;

export interface FormioV5Config {
  apiBaseUrl: string;
  adminApiUrl: string;
  renderApiUrl: string;
  adminUsername: string;
  adminPassword: string;
  managerUsername: string;
  managerPassword: string;
  projectPath?: string;
  version?: string;
}

const loadConfig = (config: PluginConfigReader): FormioV5Config => {
  return {
    apiBaseUrl: config.getRequired('API_BASE_URL'),
    adminApiUrl: config.getRequired('ADMIN_API_URL'),
    renderApiUrl: config.getRequired('RENDER_API_URL'),
    adminUsername: config.getRequired('ADMIN_USERNAME'),
    adminPassword: config.getRequired('ADMIN_PASSWORD'),
    managerUsername: config.getRequired('MANAGER_USERNAME'),
    managerPassword: config.getRequired('MANAGER_PASSWORD'),
    projectPath: config.getOptional('PROJECT_PATH'),
    version: config.getOptional('VERSION'),
  };
};

export class FormioEngineAdapter implements FormEngineAdapter {
  private readonly config: FormioV5Config;

  constructor(config: PluginConfigReader) {
    this.config = loadConfig(config);
  }

  async createFormVersionSchema(input: FormVersionProvisionInput): Promise<{ engineRef: string }> {
    // This adapter is intentionally lightweight for iteration 1.
    return { engineRef: placeholderRef('formio-schema', input.formVersionId) };
  }

  async createSubmissionRecord(input: SubmissionProvisionInput): Promise<{ engineRef: string }> {
    // This adapter is intentionally lightweight for iteration 1.
    return { engineRef: placeholderRef('formio-submission', input.submissionId) };
  }
}
