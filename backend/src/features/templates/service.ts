import { v7 as uuidv7 } from 'uuid';
import { env } from '../../core/config/env';
import {
  deleteDocumentTemplate,
  getDocumentTemplate,
  insertDocumentTemplate,
  listDocumentTemplates,
  renameDocumentTemplate,
  setDocumentTemplateFile,
  type DocumentTemplateWithFile,
} from '../../core/db/repos/documentTemplateRepo';
import { fileStore, storedOrThrow } from '../../core/services/fileStore';
import type { GetFileResult } from '../../core/integrations/storage-engine/StorageEngineAdapter';
import { ConflictError } from '../../core/errors';
import { log } from '../../core/logging';

/** Who is acting, and in which workspace. */
export interface TemplateActor {
  workspaceId: string;
  actorId: string;
}

export interface TemplateFile {
  filename: string;
  contentType?: string;
  size?: number;
  buffer: Buffer;
}

const TEMPLATE_CHANGED = 'Template changed while this request ran; reload it and retry';

const toStoreInput = (actor: TemplateActor, file: TemplateFile) => ({
  workspaceId: actor.workspaceId,
  actorId: actor.actorId,
  profile: env.getTemplatesStorageProfile(),
  prefix: env.getTemplatesStoragePrefix(),
  ...file,
});

export const templatesService = {
  list(formVersionId: string): Promise<DocumentTemplateWithFile[]> {
    return listDocumentTemplates(formVersionId);
  },

  get(id: string): Promise<DocumentTemplateWithFile | null> {
    return getDocumentTemplate(id);
  },

  /** The template's file contents; null when the storage backend no longer has it. */
  open(template: DocumentTemplateWithFile): Promise<GetFileResult | null> {
    return fileStore.open(template.file);
  },

  async create(
    actor: TemplateActor,
    formVersion: { id: string; formId: string },
    name: string,
    file: TemplateFile,
  ): Promise<DocumentTemplateWithFile | null> {
    const id = uuidv7();
    storedOrThrow(
      await fileStore.put(toStoreInput(actor, file), (tx, record) =>
        insertDocumentTemplate(tx, {
          id,
          workspaceId: actor.workspaceId,
          formId: formVersion.formId,
          formVersionId: formVersion.id,
          fileId: record.id,
          name,
          createdBy: actor.actorId,
        }),
      ),
    );
    return getDocumentTemplate(id);
  },

  /** Store the new file under the same template id, then remove the file it replaced. */
  async replaceFile(
    existing: DocumentTemplateWithFile,
    actor: TemplateActor,
    file: TemplateFile,
  ): Promise<DocumentTemplateWithFile | null> {
    const { id } = existing.template;
    storedOrThrow(
      await fileStore.put(toStoreInput(actor, file), async (tx, record) => {
        if (!(await setDocumentTemplateFile(tx, id, existing.file.id, record.id, actor.actorId))) {
          throw new ConflictError(TEMPLATE_CHANGED);
        }
      }),
    );
    // The template points at the new file, so the old one has no link to remove.
    await fileStore
      .remove(existing.file, async () => undefined)
      .catch((err: unknown) => {
        log.warn(
          { err, templateId: id, fileId: existing.file.id },
          'Replaced template file not removed',
        );
      });
    return getDocumentTemplate(id);
  },

  async rename(
    id: string,
    name: string,
    actorId: string,
  ): Promise<DocumentTemplateWithFile | null> {
    const renamed = await renameDocumentTemplate(id, name, actorId);
    return renamed ? getDocumentTemplate(id) : null;
  },

  remove(existing: DocumentTemplateWithFile): Promise<void> {
    return fileStore.remove(existing.file, async (tx, record) => {
      if (!(await deleteDocumentTemplate(tx, existing.template.id, record.id))) {
        throw new ConflictError(TEMPLATE_CHANGED);
      }
    });
  },
};
