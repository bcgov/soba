import {
  createForm,
  FormCursorMode,
  FormRecord,
  FormListSort,
  getFormById,
  listFormsForWorkspace,
  markFormDeleted,
  updateForm,
} from '../db/repos/formRepo';
import { env } from '../config/env';
import {
  getFormEnginePlugins,
  resolveFormEnginePlugin,
} from '../integrations/form-engine/FormEngineRegistry';
import { ValidationError } from '../errors';

interface DeleteInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  formId: string;
}

interface ListInput {
  workspaceId: string;
  actorId: string;
  limit: number;
  q?: string;
  status?: string;
  sort: FormListSort;
  cursorMode: FormCursorMode;
  afterId?: string;
  afterUpdatedAt?: Date;
}

interface CreateInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  slug: string;
  name: string;
  description?: string;
  formEngineCode?: string;
}

interface UpdateInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  formId: string;
  slug?: string;
  name?: string;
  description?: string | null;
  status?: string;
}

export class FormService {
  async create(input: CreateInput): Promise<FormRecord> {
    const plugins = getFormEnginePlugins();
    if (plugins.length === 0) {
      throw new ValidationError('No form engine plugins installed.');
    }
    const defaultCode =
      env.getFormEngineDefaultCode() ??
      (plugins.some((p) => p.code === 'formio-v5') ? 'formio-v5' : plugins[0].code);
    const engineCode = input.formEngineCode ?? defaultCode;
    const installed = plugins.some((p) => p.code === engineCode);
    if (!installed) {
      throw new ValidationError(
        input.formEngineCode
          ? `Form engine '${input.formEngineCode}' is not installed`
          : `Default form engine '${defaultCode}' is not installed`,
      );
    }
    resolveFormEnginePlugin(engineCode);

    return createForm({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      actorDisplayLabel: input.actorDisplayLabel,
      slug: input.slug,
      name: input.name,
      description: input.description,
      formEngineCode: engineCode,
    });
  }

  async update(input: UpdateInput): Promise<FormRecord | null> {
    return updateForm(input);
  }

  async get(workspaceId: string, actorId: string, formId: string): Promise<FormRecord | null> {
    return getFormById(workspaceId, formId);
  }

  async list(input: ListInput) {
    return listFormsForWorkspace(input);
  }

  async delete(input: DeleteInput) {
    return markFormDeleted(
      input.workspaceId,
      input.formId,
      input.actorId,
      input.actorDisplayLabel,
    );
  }
}
