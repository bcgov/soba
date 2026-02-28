import { actorBelongsToWorkspace } from '../db/repos/membershipRepo';
import {
  getActiveFormEngineByCode,
  getDefaultActiveFormEngine,
} from '../db/repos/platformFormEngineRepo';
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
import { resolveFormEnginePlugin } from '../integrations/form-engine/FormEngineRegistry';

interface DeleteInput {
  workspaceId: string;
  actorId: string;
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
  slug: string;
  name: string;
  description?: string;
  formEngineCode?: string;
}

interface UpdateInput {
  workspaceId: string;
  actorId: string;
  formId: string;
  slug?: string;
  name?: string;
  description?: string | null;
  status?: string;
}

export class FormService {
  async create(input: CreateInput): Promise<FormRecord> {
    const inWorkspace = await actorBelongsToWorkspace(input.workspaceId, input.actorId);
    if (!inWorkspace) throw new Error('Actor does not belong to workspace');

    const selectedEngine = input.formEngineCode
      ? await getActiveFormEngineByCode(input.formEngineCode)
      : await getDefaultActiveFormEngine();
    if (!selectedEngine) {
      throw new Error(
        input.formEngineCode
          ? `Form engine '${input.formEngineCode}' is not available`
          : 'No default active form engine is configured',
      );
    }
    resolveFormEnginePlugin(selectedEngine.code);

    return createForm({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      slug: input.slug,
      name: input.name,
      description: input.description,
      formEngineId: selectedEngine.id,
    });
  }

  async update(input: UpdateInput): Promise<FormRecord | null> {
    const inWorkspace = await actorBelongsToWorkspace(input.workspaceId, input.actorId);
    if (!inWorkspace) throw new Error('Actor does not belong to workspace');
    return updateForm(input);
  }

  async get(workspaceId: string, actorId: string, formId: string): Promise<FormRecord | null> {
    const inWorkspace = await actorBelongsToWorkspace(workspaceId, actorId);
    if (!inWorkspace) throw new Error('Actor does not belong to workspace');
    return getFormById(workspaceId, formId);
  }

  async list(input: ListInput) {
    const inWorkspace = await actorBelongsToWorkspace(input.workspaceId, input.actorId);
    if (!inWorkspace) throw new Error('Actor does not belong to workspace');
    return listFormsForWorkspace(input);
  }

  async delete(input: DeleteInput) {
    const inWorkspace = await actorBelongsToWorkspace(input.workspaceId, input.actorId);
    if (!inWorkspace) throw new Error('Actor does not belong to workspace');
    return markFormDeleted(input.workspaceId, input.formId, input.actorId);
  }
}
