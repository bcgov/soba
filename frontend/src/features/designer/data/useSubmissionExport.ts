'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import {
  downloadSobaSubmissionFile,
  exportSobaSubmissions,
  getSobaExportFields,
} from '@/src/shared/api/sobaApi';
import type { DownloadedFile } from '@/src/shared/api/sobaApiDesign';
import { useAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { listReadConfig, sessionReadConfig } from '@/src/shared/api/swrConfig';
import { classifyDataError } from '@/src/shared/api/dataError';
import type { Resource, WriteOutcome } from '@/src/shared/api/dataContracts';
import type {
  SubmissionExportBody,
  SubmissionExportFieldsBody,
  SubmissionExportFieldsResponse,
} from '@/src/types/submissionExport';
import type { FormVersionSummary } from '@/src/types/forms';
import { useDesignFormRead, useFormVersionLookup } from './useForm';

const EXPORT_FIELDS_KEY = 'submission-export-fields';

/** The form's name and versions, from the designer's cached reads. */
export function useExportForm(
  formId: string,
): Resource<{ name: string; versions: FormVersionSummary[] }> {
  const form = useDesignFormRead(formId);
  const versions = useFormVersionLookup(formId);
  const error = form.error ?? versions.error;
  return {
    data:
      form.data && versions.data ? { name: form.data.name, versions: versions.data.items } : null,
    isLoading: form.isLoading || versions.isLoading,
    error: error ? classifyDataError(error) : null,
    refresh: async () => {
      await Promise.all([form.mutate(), versions.mutate()]);
    },
  };
}

/** Export columns and last export; null filters wait. */
export function useExportFields(
  formId: string,
  filters: SubmissionExportFieldsBody | null,
): Resource<SubmissionExportFieldsResponse> {
  const { data, isLoading, error, mutate } = useAuthedSWR(
    filters ? [EXPORT_FIELDS_KEY, formId, JSON.stringify(filters)] : null,
    (token) => getSobaExportFields(token, formId, filters!),
    listReadConfig,
  );
  return {
    data: data ?? null,
    isLoading,
    error: error ? classifyDataError(error) : null,
    refresh: async () => {
      await mutate();
    },
  };
}

/** Export the form's submissions; a failure throws. */
export function useSubmissionExporter(formId: string) {
  const { mutate } = useSWRConfig();
  const exportFile = useCallback(
    async (token: string, body: SubmissionExportBody): Promise<WriteOutcome<DownloadedFile>> => {
      const file = await exportSobaSubmissions(token, formId, body);
      // The last export date changed.
      await mutate(
        (key) => Array.isArray(key) && key[0] === EXPORT_FIELDS_KEY && key[1] === formId,
      );
      return { status: 'applied', value: file };
    },
    [formId, mutate],
  );
  return { exportFile };
}

/** A submission's file, for staff. */
export function useSubmissionFile(submissionId: string, fileId: string): Resource<DownloadedFile> {
  const { data, isLoading, error, mutate } = useAuthedSWR(
    ['design-submission-file', submissionId, fileId],
    (token) => downloadSobaSubmissionFile(token, submissionId, fileId),
    sessionReadConfig,
  );
  return {
    data: data ?? null,
    isLoading,
    error: error ? classifyDataError(error) : null,
    refresh: async () => {
      await mutate();
    },
  };
}
