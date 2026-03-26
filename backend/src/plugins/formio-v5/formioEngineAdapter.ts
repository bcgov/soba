import {
  FormEngineAdapter,
  type FormEngineReadinessResult,
  FormVersionProvisionInput,
  SubmissionProvisionInput,
} from '../../core/integrations/form-engine/FormEngineAdapter';
import { PluginConfigReader } from '../../core/config/pluginConfig';
import { getAuthenticatedFormioClient } from './formioV5Client';
import { getTempDemoFormDefinition } from './tempDemoFormDefinition';

const placeholderRef = (prefix: string, id: string) => `${prefix}-${id}`;

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

function sanitizePathSegment(raw: string): string {
  const s = raw
    .replace(/[^a-z0-9-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s.length > 0 ? s.toLowerCase() : 'form';
}

function cloneFormDefinition(def: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(def)) as Record<string, unknown>;
}

/** Tags for tenancy: `soba` plus workspace id (SOBA tenant) for Form.io filtering. */
function mergeSobaWorkspaceTags(existing: unknown, workspaceId: string): string[] {
  const out = new Set<string>();
  out.add('soba');
  out.add(workspaceId);
  if (Array.isArray(existing)) {
    for (const t of existing) {
      const s = t == null ? '' : String(t).trim();
      if (s) out.add(s);
    }
  } else if (typeof existing === 'string' && existing.trim()) {
    for (const part of existing.split(',')) {
      const s = part.trim();
      if (s) out.add(s);
    }
  }
  return [...out];
}

export class FormioEngineAdapter implements FormEngineAdapter {
  private readonly config: FormioV5Config;
  private readonly pluginConfig: PluginConfigReader;

  constructor(pluginConfig: PluginConfigReader) {
    this.pluginConfig = pluginConfig;
    this.config = loadConfig(pluginConfig);
  }

  async createFormVersionSchema(input: FormVersionProvisionInput): Promise<{ engineRef: string }> {
    const client = await getAuthenticatedFormioClient(this.pluginConfig);
    if (!client) {
      return { engineRef: placeholderRef('formio-schema', input.formVersionId) };
    }

    const baseRaw =
      input.formioFormDefinition != null
        ? cloneFormDefinition(input.formioFormDefinition)
        : getTempDemoFormDefinition();

    const vid = input.formVersionId.replace(/-/g, '');
    const short = vid.slice(0, 8);
    const slug = sanitizePathSegment(input.formSlug ?? 'soba-form');
    const displayName = (input.formName ?? 'Form').trim() || 'Form';
    const path = `${slug}-${short}`;

    const prevProps =
      typeof baseRaw.properties === 'object' &&
      baseRaw.properties !== null &&
      !Array.isArray(baseRaw.properties)
        ? (baseRaw.properties as Record<string, unknown>)
        : {};

    const body: Record<string, unknown> = {
      ...baseRaw,
      title: displayName,
      name: slug,
      path,
      properties: {
        ...prevProps,
        soba_workspace_id: input.workspaceId,
        soba_form_version_id: input.formVersionId,
      },
    };

    delete body._id;
    delete body.machineName;

    body.tags = mergeSobaWorkspaceTags(body.tags, input.workspaceId);

    const created = await client.saveForm(body);
    const id = created && typeof created === 'object' && '_id' in created ? created._id : null;
    if (id == null || id === '') {
      throw new Error('Form.io saveForm did not return _id');
    }
    return { engineRef: String(id) };
  }

  async createSubmissionRecord(input: SubmissionProvisionInput): Promise<{ engineRef: string }> {
    return { engineRef: placeholderRef('formio-submission', input.submissionId) };
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
