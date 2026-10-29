'use client';

import { useCallback, useMemo } from 'react';
import { useSWRConfig } from 'swr';
import {
  getSobaExportFields,
  listSobaSubmissionExports,
  startSobaSubmissionExport,
} from '@/src/shared/api/sobaApi';
import { useAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { sessionReadConfig } from '@/src/shared/api/swrConfig';
import { classifyDataError } from '@/src/shared/api/dataError';
import type { ListResult, Resource, WriteOutcome } from '@/src/shared/api/dataContracts';
import type {
  StartSubmissionExportBody,
  SubmissionExport,
  SubmissionExportFieldsBody,
  SubmissionExportFieldsResponse,
} from '@/src/types/submissionExport';
import type { FormVersionSummary } from '@/src/types/forms';
import { useDesignFormRead, useFormVersionLookup } from './useForm';

const EMPTY: SubmissionExport[] = [];

const exportsKey = (formId: string) => ['submission-exports', formId];

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

/**
 * The fields an export with these filters can include; null filters wait. No previous data is kept
 * across a filter change, so `data` is null until the new list arrives.
 */
export function useExportFields(
  formId: string,
  filters: SubmissionExportFieldsBody | null,
): Resource<SubmissionExportFieldsResponse> {
  const { data, isLoading, error, mutate } = useAuthedSWR(
    filters ? ['submission-export-fields', formId, JSON.stringify(filters)] : null,
    (token) => getSobaExportFields(token, formId, filters!),
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

/** The caller's exports of the form, newest first. */
export function useSubmissionExports(formId: string): ListResult<SubmissionExport> {
  const { data, isLoading, isValidating, error, mutate } = useAuthedSWR(
    exportsKey(formId),
    (token) => listSobaSubmissionExports(token, formId),
  );
  const rows = useMemo(() => data?.items ?? EMPTY, [data]);
  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);
  return {
    rows,
    total: data ? rows.length : undefined,
    isLoading,
    isRefreshing: isValidating && data !== undefined,
    error: error ? classifyDataError(error) : null,
    refresh,
  };
}

/** Start an export; a failure throws. Refreshes the list of exports. */
export function useSubmissionExportStarter(formId: string) {
  const { mutate } = useSWRConfig();
  const start = useCallback(
    async (
      token: string,
      body: StartSubmissionExportBody,
    ): Promise<WriteOutcome<SubmissionExport>> => {
      const value = await startSobaSubmissionExport(token, formId, body);
      await mutate(exportsKey(formId));
      return { status: 'applied', value };
    },
    [formId, mutate],
  );
  return { start };
}
