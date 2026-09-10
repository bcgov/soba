import { index, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { auditColumns, idColumn } from './audit';
import { sobaSchema } from './core';
import { files } from './file';
import { forms } from './forms';

export const documentGenerationTemplates = sobaSchema.table(
  'document_generation_template',
  {
    id: idColumn(),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id),
    ...auditColumns(),
  },
  (table) => ({
    fileUnique: uniqueIndex('document_generation_template_file_uq').on(table.fileId),
    formIdx: index('document_generation_template_form_idx').on(table.formId),
  }),
);

export const documentGenerationFormConfigurations = sobaSchema.table(
  'document_generation_form_configuration',
  {
    formId: uuid('form_id')
      .primaryKey()
      .references(() => forms.id),
    printableName: text('printable_name'),
    defaultTemplateId: uuid('default_template_id').references(
      () => documentGenerationTemplates.id,
      { onDelete: 'set null' },
    ),
    ...auditColumns(),
  },
  (table) => ({
    defaultTemplateIdx: index('document_generation_form_configuration_default_template_idx').on(
      table.defaultTemplateId,
    ),
  }),
);
