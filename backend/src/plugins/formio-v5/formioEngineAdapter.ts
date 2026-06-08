import {
  FormEngineAdapter,
  type FormEngineReadinessResult,
} from '../../core/integrations/form-engine/FormEngineAdapter';
import { PluginConfigReader } from '../../core/config/pluginConfig';

export interface FormioV5Config {
  apiBaseUrl: string;
  adminApiUrl: string;
  renderApiUrl: string;
  adminUsername: string;
  adminPassword: string;
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
    projectPath: config.getOptional('PROJECT_PATH'),
    version: config.getOptional('VERSION'),
  };
};

export class FormioEngineAdapter implements FormEngineAdapter {
  private readonly config: FormioV5Config;

  constructor(pluginConfig: PluginConfigReader) {
    this.config = loadConfig(pluginConfig);
  }

  async readinessCheck(): Promise<FormEngineReadinessResult> {
    try {
      const url = this.config.renderApiUrl.replace(/\/$/, '') || this.config.renderApiUrl;
      const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
      if (res.ok || res.status === 404) {
        return { ok: true };
      }
      return { ok: false, message: `HTTP ${res.status}` };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
