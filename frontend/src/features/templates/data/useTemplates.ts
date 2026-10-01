'use client';

import { useCallback } from 'react';
import { useAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { sessionReadConfig } from '@/src/shared/api/swrConfig';
import type { TemplateResponse } from '@/src/types/templates';
import { deleteTemplate, downloadTemplate, listTemplates, uploadTemplate } from './api';

const EMPTY_TEMPLATES: TemplateResponse[] = [];

/** Hand a downloaded template to the browser under its own file name. */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * The document templates on one form version, and the writes that change them. Each write
 * re-reads the list, so a caller never refreshes by hand.
 */
export function useTemplates(formVersionId: string | null) {
  const key = formVersionId ? (['form-version-templates', formVersionId] as const) : null;
  const { data, error, isLoading, mutate } = useAuthedSWR(
    key,
    (token) => listTemplates(token, formVersionId as string),
    sessionReadConfig,
  );

  const upload = useCallback(
    async (token: string, name: string, file: File): Promise<void> => {
      if (!formVersionId) return;
      await uploadTemplate(token, formVersionId, name, file);
      await mutate();
    },
    [formVersionId, mutate],
  );

  const remove = useCallback(
    async (token: string, templateId: string): Promise<void> => {
      await deleteTemplate(token, templateId);
      await mutate();
    },
    [mutate],
  );

  const download = useCallback(async (token: string, template: TemplateResponse): Promise<void> => {
    saveBlob(await downloadTemplate(token, template.id), template.filename);
  }, []);

  return {
    templates: data?.items ?? EMPTY_TEMPLATES,
    loading: !!key && isLoading,
    error: (error ?? null) as unknown,
    upload,
    remove,
    download,
  };
}
