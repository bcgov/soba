import { expect, type Page } from '@playwright/test';
import dictionaries from '../../../frontend/dictionaries/en.json';

export async function createForm({ page, title }: { page: Page; title: string }): Promise<string> {
  await page.goto('');

  // Only create a workspace when the first-run onboarding modal is actually shown.
  // Reused auth sessions may already have a workspace, so we should not recreate one
  // on every run.
  const workspaceModal = page.getByRole('dialog', {
    name: /Default Workspace Setup/i,
  });
  const workspaceSetupVisible = await workspaceModal
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(
      () => true,
      () => false,
    );

  if (workspaceSetupVisible) {
    await page.getByTestId('workspace-name').locator('input').fill('Test Workspace');

    await page.getByTestId('workspace-your-org').click();
    await page
      .getByRole('option', {
        name: 'Health (HLTH)',
        exact: true,
      })
      .click();

    await page.getByTestId('workspace-use-case').click();

    const collectionUseCase = dictionaries.useCases['collection'];
    if (collectionUseCase) {
      await page
        .getByRole('option', {
          name: new RegExp(collectionUseCase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        })
        .click();
    }

    const disclaimerCheckbox = page.getByRole('checkbox', {
      name: /I agree to the disclaimer and statement of responsibility/i,
    });
    const disclaimerLabel = page.getByText(
      /I agree to the disclaimer and statement of responsibility/i,
    );
    await disclaimerLabel.scrollIntoViewIfNeeded();
    await expect(disclaimerLabel).toBeVisible();
    await expect(disclaimerLabel).toBeEnabled();
    await disclaimerLabel.click();
    await expect(disclaimerCheckbox).toBeChecked();

    const saveButton = page.getByTestId('workspace-save');
    await expect(saveButton).toBeEnabled({ timeout: 15000 });
    await saveButton.click();

    await expect(workspaceModal).not.toBeVisible({ timeout: 15000 });
    await expect(page.locator('.react-aria-ModalOverlay')).not.toBeVisible({
      timeout: 15000,
    });
  }

  await page.getByTestId('forms-nav').click();
  await page.getByTestId('create-form-button').click();

  const createFormDialog = page.getByRole('dialog', { name: 'Create Form' });
  const workspaceSelector = createFormDialog.getByTestId('workspace-select');
  await expect(workspaceSelector).toBeVisible();
  await workspaceSelector.click();

  const workspaceOptions = page
    .getByRole('listbox', { name: dictionaries.workspaces.workspace })
    .getByRole('option');
  await expect(workspaceOptions.first()).toBeVisible();

  const createdWorkspaceOption = workspaceOptions.filter({ hasText: 'Test Workspace' }).first();

  const workspaceOption =
    (await createdWorkspaceOption.count()) > 0 ? createdWorkspaceOption : workspaceOptions.first();

  // Options read "<name> (<kind>)".
  const workspaceName = (await workspaceOption.innerText()).trim().replace(/ \([^)]*\)$/, '');
  await workspaceOption.click();

  const formNameInput = createFormDialog
    .locator('label', { hasText: 'Form Name' })
    .locator('xpath=following-sibling::div//input');
  await formNameInput.fill(title);
  await createFormDialog.getByTestId('save-create-form').click();

  return workspaceName;
}
