'use client';

import { useCallback, useState } from 'react';
import { useSWRConfig } from 'swr';
import type { FormType } from '@formio/react';
import {
  createFormVersion,
  createSobaFormioForm,
  getFormVersionSchema,
  getSobaForm,
  getSobaFormVersion,
  lookupFormVersions,
  publishSobaFormVersion,
  saveFormVersionSchema,
} from '@/src/shared/api/sobaApi';
import { updateSobaForm } from '@/src/shared/api/sobaApiDesign';
import { useAuthedSWR } from '@/src/shared/api/useAuthedSWR';
import { sessionReadConfig } from '@/src/shared/api/swrConfig';
import { classifyDataError } from '@/src/shared/api/dataError';
import type { DataError, WriteOutcome } from '@/src/shared/api/dataContracts';
import type {
  CreateSobaFormioFormResponse,
  FormVersionSummary,
  SobaFormType,
} from '@/src/types/forms';
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

type FormPatch = Parameters<typeof updateSobaForm>[2];
type FormRecord = Awaited<ReturnType<typeof updateSobaForm>>;
type NewVersion = Awaited<ReturnType<typeof createFormVersion>>;

/**
 * The write side of one form: its record, its version schemas, and new versions. Each action
 * refreshes the caches it affects (the form, the version list, and the schema just written), so a
 * component never refreshes by hand.
 */
export function useFormWriter(formId: string) {
  const { mutate } = useSWRConfig();

  const refreshForm = useCallback(() => mutate(['design-form', formId]), [mutate, formId]);
  // The form carries the current version, so a new version changes it too: refresh both.
  const refreshVersions = useCallback(() => {
    const [prefix] = versionsKey(formId);
    return Promise.all([
      refreshForm(),
      mutate((key) => Array.isArray(key) && key[0] === prefix && key[1] === formId),
    ]);
  }, [mutate, formId, refreshForm]);
  // The schema just written, seeded into the cache so the next read does not drop back to the
  // pre-save body (these reads do not revalidate on their own).
  const commitSchema = useCallback(
    (versionId: string, schema: FormType) =>
      mutate(formVersionSchemaKey(versionId), schema, { revalidate: false }),
    [mutate],
  );

  const update = useCallback(
    async (token: string, patch: FormPatch): Promise<WriteOutcome<FormRecord>> => {
      const value = await updateSobaForm(token, formId, patch);
      await Promise.all([refreshForm(), mutate((key) => Array.isArray(key) && key[0] === 'forms')]);
      return { status: 'applied', value };
    },
    [mutate, formId, refreshForm],
  );

  const createVersion = useCallback(
    async (
      token: string,
      sourceSchema: FormType,
      fromVersionId?: string,
    ): Promise<WriteOutcome<NewVersion>> => {
      const value = await createFormVersion(token, formId, fromVersionId);
      await saveFormVersionSchema(token, value.id, sourceSchema);
      await commitSchema(value.id, sourceSchema);
      await refreshVersions();
      return { status: 'applied', value };
    },
    [formId, commitSchema, refreshVersions],
  );

  const restoreVersion = useCallback(
    async (token: string, fromVersionId: string): Promise<WriteOutcome<NewVersion>> => {
      const sourceSchema = ((await getFormVersionSchema(token, fromVersionId)) ?? {}) as FormType;
      return createVersion(token, sourceSchema, fromVersionId);
    },
    [createVersion],
  );

  const saveSchema = useCallback(
    async (
      token: string,
      versionId: string,
      schema: FormType,
      publish: boolean,
    ): Promise<WriteOutcome<void>> => {
      await saveFormVersionSchema(token, versionId, schema);
      if (publish) {
        await publishSobaFormVersion(token, versionId);
        await refreshVersions();
      }
      await commitSchema(versionId, schema);
      await refreshForm();
      return { status: 'applied', value: undefined };
    },
    [commitSchema, refreshVersions, refreshForm],
  );

  return { update, createVersion, restoreVersion, saveSchema };
}

/** Create a new form with an empty first-version schema, ready to open in the designer. */
export function useFormCreator() {
  const create = useCallback(
    async (
      token: string,
      data: SobaFormType,
      workspaceId?: string,
    ): Promise<WriteOutcome<CreateSobaFormioFormResponse>> => {
      const value = await createSobaFormioForm(token, data, workspaceId);
      // A version with no schema 404s when read; the empty schema leaves an openable draft.
      if (value.formVersion?.id) {
        await saveFormVersionSchema(token, value.formVersion.id, { components: [] } as FormType);
      }
      return { status: 'applied', value };
    },
    [],
  );
  return { create };
}
