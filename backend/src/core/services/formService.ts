import type { CreateFormSettings, SortLocale } from '@soba/lib';
import {
  createForm,
  FormRecord,
  FormListSort,
  formNameExistsInWorkspace,
  getFormById,
  listFormsForWorkspace,
  markFormDeleted,
  updateForm,
  getFormByEngineSchemaRef,
} from '../db/repos/formRepo';
import { listFormsForSubmitter, type ListSubmitterFormsInput } from '../db/repos/submitterFormRepo';
import { createEmptyFormVersionDraft } from '../db/repos/formVersionRepo';
import type { FormAccessGrant } from '../db/repos/formAccessRepo';
import { isWorkspaceDisclaimerAccepted } from '../db/repos/workspaceRepo';
import { db, type DbOrTx } from '../db/client';
import { env } from '../config/env';
import {
  createFormEngineAdapter,
  getFormEnginePlugins,
  resolveFormEnginePlugin,
} from '../integrations/form-engine/FormEngineRegistry';
import { ConflictError, ValidationError } from '../errors';
import { FORM_NAME_TAKEN } from '../messages';
import { createFormSettings } from '../../features/form-settings/create';

interface DeleteInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  formId: string;
}

interface ListInput {
  workspaceIds: string[];
  actorId: string;
  formAccess: FormAccessGrant;
  offset: number;
  limit: number;
  formId?: string;
  q?: string;
  status?: string;
  sort: FormListSort;
  locale: SortLocale;
}

interface CreateInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  name: string;
  description?: string;
  formEngineCode?: string;
  /** Settings the form starts with instead of inheriting its workspace's. */
  settings?: CreateFormSettings;
  executor?: DbOrTx;
}

interface UpdateInput {
  workspaceId: string;
  actorId: string;
  actorDisplayLabel: string | null;
  formId: string;
  name?: string;
  description?: string | null;
  org?: string;
  useCase?: string;
  status?: string;
}

export class FormService {
  async create(input: CreateInput): Promise<{
    form: FormRecord;
    version: Awaited<ReturnType<typeof createEmptyFormVersionDraft>>;
  }> {
    // Gate: the workspace disclaimer must be accepted before any form can be created.
    if (!(await isWorkspaceDisclaimerAccepted(input.workspaceId))) {
      throw new ConflictError('Accept the workspace disclaimer before creating forms');
    }
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

    if (await formNameExistsInWorkspace(input.workspaceId, input.name)) {
      throw new ConflictError(FORM_NAME_TAKEN);
    }

    const executor = input.executor ?? db;
    // One-call create: form, an empty v1 draft and every settings group's row, in one transaction.
    return executor.transaction(async (tx) => {
      const form = await createForm(
        {
          workspaceId: input.workspaceId,
          actorId: input.actorId,
          actorDisplayLabel: input.actorDisplayLabel,
          name: input.name,
          description: input.description,
          formEngineCode: engineCode,
        },
        tx,
      );
      const version = await createEmptyFormVersionDraft(
        {
          workspaceId: input.workspaceId,
          formId: form.id,
          actorId: input.actorId,
          actorDisplayLabel: input.actorDisplayLabel,
        },
        tx,
      );
      await createFormSettings(
        {
          workspaceId: input.workspaceId,
          formId: form.id,
          actorId: input.actorId,
          actorDisplayLabel: input.actorDisplayLabel,
          settings: input.settings,
        },
        tx,
      );
      return { form, version };
    });
  }

  async update(input: UpdateInput): Promise<FormRecord | null> {
    if (
      input.name !== undefined &&
      (await formNameExistsInWorkspace(input.workspaceId, input.name, input.formId))
    ) {
      throw new ConflictError(FORM_NAME_TAKEN);
    }
    return updateForm(input);
  }

  /**
   * Normalize a schema (import file or export) into a clean, portable, builder-ready form
   * definition using the default form engine. Returns it unchanged if the engine can't normalize.
   */
  normalizeSchema(schema: Record<string, unknown>): Record<string, unknown> {
    const plugins = getFormEnginePlugins();
    if (plugins.length === 0) {
      throw new ValidationError('No form engine plugins installed.');
    }
    const defaultCode =
      env.getFormEngineDefaultCode() ??
      (plugins.some((p) => p.code === 'formio-v5') ? 'formio-v5' : plugins[0].code);
    const adapter = createFormEngineAdapter(defaultCode);
    if (typeof adapter.normalizeSchema !== 'function') {
      return schema;
    }
    return adapter.normalizeSchema(schema);
  }

  async get(workspaceId: string, formId: string): Promise<FormRecord | null> {
    return getFormById(workspaceId, formId);
  }

  async getByEngineSchemaRef(
    workspaceId: string,
    engineSchemaRef: string,
  ): Promise<FormRecord | null> {
    return getFormByEngineSchemaRef(workspaceId, engineSchemaRef);
  }

  async list(input: ListInput) {
    return listFormsForWorkspace(input);
  }

  /** The forms the user holds the submitter role on or has submitted to, in every workspace. */
  async listForSubmitter(input: ListSubmitterFormsInput) {
    return listFormsForSubmitter(input);
  }

  async delete(input: DeleteInput) {
    return markFormDeleted(input.workspaceId, input.formId, input.actorDisplayLabel);
  }
}
