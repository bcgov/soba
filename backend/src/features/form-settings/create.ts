import type { DbOrTx } from '../../core/db/client';
import { formSettingsModules } from './registry';
import type { FormSettingsRowInput, SettingsRowInput } from './types';

/**
 * Creates every group's row for a new form, in the transaction that creates the form. A group named
 * in `settings` starts with those values; the rest inherit.
 */
export const createFormSettings = async (
  input: FormSettingsRowInput,
  executor: DbOrTx,
): Promise<void> => {
  for (const module of formSettingsModules) {
    await module.createForForm(input, executor);
  }
};

/** Creates every shared group's row for a new workspace, in the transaction that creates it. */
export const createWorkspaceSettings = async (
  input: SettingsRowInput,
  executor: DbOrTx,
): Promise<void> => {
  for (const module of formSettingsModules) {
    await module.workspace?.createForWorkspace(input, executor);
  }
};
