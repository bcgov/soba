'use client';

import { useCallback, useState } from 'react';
import { useSWRConfig } from 'swr';
import type { FormType } from '@formio/react';
import { getSobaForm, getSobaFormVersion, lookupFormVersions } from '@/src/shared/api/sobaApi';
import { useAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { sessionReadConfig } from '@/src/shared/api/swrConfig';
import { classifyDataError } from '@/src/shared/api/dataError';
import type { DataError } from '@/src/shared/api/dataContracts';
import type { FormVersionSummary } from '@/src/types/forms';
import { versionsKey } from './useFormVersions';
import { formVersionSchemaKey, useFormVersionSchema } from './useFormVersionSchema';

const EMPTY_VERSIONS: FormVersionSummary[] = [];

/**
 * What the designer is editing: the form, its current version, the selected version's schema, and
 * the unsaved edits layered over them. Edits are held apart from the loaded values so a
 * revalidation can never overwrite what the user has typed.
 */
export function useForm(formId?: string) {
  const {
    data: form,
    mutate: refreshForm,
    error: formError,
  } = useAuthedSWR(
    formId ? ['design-form', formId] : null,
    (token) => getSobaForm(token, formId as string),
    sessionReadConfig,
  );

  // Save and publish target this version, so it comes from the form and never from the options.
  const currentVersion: FormVersionSummary | null = form?.currentVersion ?? null;

  const { data: versionOptions, error: versionsError } = useAuthedSWR(
    formId ? [...versionsKey(formId), 'lookup'] : null,
    (token) => lookupFormVersions(token, formId as string),
    sessionReadConfig,
  );
  const versions = Array.isArray(versionOptions?.items) ? versionOptions.items : EMPTY_VERSIONS;

  const [selectedVersionId, setSelectedVersionId] = useState<string>('current');
  const isHistoryView = selectedVersionId !== 'current';

  // Read by id, so the history tab can open a version the options stopped short of.
  const { data: selectedVersion, error: selectedVersionError } = useAuthedSWR(
    isHistoryView ? ['form-version', selectedVersionId] : null,
    (token) => getSobaFormVersion(token, selectedVersionId),
    sessionReadConfig,
  );
  const activeVersion: FormVersionSummary | null = isHistoryView
    ? (selectedVersion ?? null)
    : currentVersion;

  const {
    data: loadedSchema,
    isLoading: schemaLoading,
    error: schemaError,
  } = useFormVersionSchema(activeVersion?.id);

  const { mutate: globalMutate } = useSWRConfig();

  /**
   * The schema just written to a version, as the new cached value. Without this a save drops back
   * to the pre-save body: the read never revalidates, so the next save or new version would post
   * the schema as it was before the edits.
   */
  const commitSchema = useCallback(
    (versionId: string, next: FormType) =>
      globalMutate(formVersionSchemaKey(versionId), next, { revalidate: false }),
    [globalMutate],
  );

  /**
   * After a version write. The form carries the current version; the key prefix reaches the
   * version options and every page of the history table.
   */
  const refreshVersions = useCallback(async () => {
    if (!formId) return;
    const [prefix] = versionsKey(formId);
    await Promise.all([
      refreshForm(),
      globalMutate((key) => Array.isArray(key) && key[0] === prefix && key[1] === formId),
    ]);
  }, [globalMutate, formId, refreshForm]);

  // schemaError arrives already classified from useFormVersionSchema; the rest are raw.
  const rawError = formError ?? versionsError ?? selectedVersionError ?? null;
  const loadError: DataError | null = rawError ? classifyDataError(rawError) : schemaError;

  const [editedSchema, setEditedSchema] = useState<FormType | null>(null);
  const [editedName, setEditedName] = useState<string | null>(null);
  // The version the unsaved edits were made on. Saving them onto another version would overwrite it.
  const [editsBaseVersionId, setEditsBaseVersionId] = useState<string | null>(null);

  const activeVersionId = activeVersion?.id ?? null;
  const markEditsBase = useCallback(
    () => setEditsBaseVersionId((base) => base ?? activeVersionId),
    [activeVersionId],
  );
  const setSchema = useCallback(
    (next: FormType | null) => {
      setEditedSchema(next);
      markEditsBase();
    },
    [markEditsBase],
  );
  const setName = useCallback(
    (next: string) => {
      setEditedName(next);
      markEditsBase();
    },
    [markEditsBase],
  );

  const discardEdits = useCallback(() => {
    setEditedSchema(null);
    setEditedName(null);
    setEditsBaseVersionId(null);
  }, []);

  const currentVersionId = currentVersion?.id;
  const selectVersion = useCallback(
    (versionId: string) => {
      // The history table lists the current version too. Opening it there opens the draft.
      setSelectedVersionId(versionId === currentVersionId ? 'current' : versionId);
      discardEdits();
    },
    [discardEdits, currentVersionId],
  );

  return {
    form: form ?? null,
    versions,
    versionsTruncated: versionOptions?.truncated === true,
    versionsLimit: versionOptions?.limit,
    currentVersion,
    activeVersion,
    selectedVersionId,
    isHistoryView,
    historicalVersionNo: isHistoryView ? (activeVersion?.versionNo ?? null) : null,
    schema: editedSchema ?? loadedSchema ?? null,
    name: editedName ?? form?.name ?? '',
    description: form?.description ?? '',
    isDirty: editedSchema !== null || editedName !== null,
    // Unsaved edits made on a version that is no longer the form's current one.
    editsStale:
      !isHistoryView && editsBaseVersionId !== null && editsBaseVersionId !== currentVersion?.id,
    // The draft is not assembled until the form, and any selected version, have answered. Until
    // then there is no schema key, so schemaLoading alone reports ready.
    // A read that failed has answered: these reads do not revalidate on their own, so reporting
    // loading here would leave the designer on a spinner for the life of the page.
    loading:
      !!formId &&
      !loadError &&
      (form === undefined || (isHistoryView && selectedVersion === undefined) || schemaLoading),
    error: loadError,
    setName,
    setSchema,
    discardEdits,
    commitSchema,
    selectVersion,
    refreshForm,
    refreshVersions,
  };
}
