import { test, expect } from '../fixtures/form_setup';
import dictionaries from '../../../frontend/dictionaries/en.json';

test.beforeEach(async ({ page, baseURL, workspaceName }) => {
  if (!baseURL) throw new Error('Playwright baseURL must be configured');
  await page.goto(`${baseURL.replace(/\/$/, '')}/workspaces`);
  await expect(page).toHaveURL(/\/workspaces(?:\?|$)/);
  // A full navigation must finish restoring the Keycloak session before the list renders.
  await expect(page.getByTestId('user-dropdown')).toBeVisible({ timeout: 20000 });
  const search = page.getByTestId('search-workspaces-text').getByRole('textbox');
  await expect(search).toBeEditable({ timeout: 15000 });
  await search.fill(workspaceName);
  await page.getByTestId('search-workspaces-button').click();

  await expect(page).toHaveURL((url) => url.searchParams.get('workspaces.q') === workspaceName);

  const workspaceRow = page
    .getByRole('table')
    .getByRole('row')
    .filter({
      has: page.getByRole('button', { name: workspaceName, exact: true }),
    });
  await expect(workspaceRow).toBeVisible();
  await workspaceRow.getByRole('button', { name: 'Manage', exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/[^/?#]+$/);
  await expect(page.getByTestId('workspace-name').getByRole('textbox')).toHaveValue(workspaceName);
});

test('User can find and manage the form workspace', async ({ page }) => {
  const organization = page.getByTestId('workspace-your-org');
  await organization.click();
  await page.getByRole('option', { name: 'BC Public Service Agency (PSA)', exact: true }).click();
  await expect(organization).toContainText('BC Public Service Agency (PSA)');
  await page.getByTestId('workspace-use-case').click();

  const collectionUseCase = dictionaries.useCases['registration'];
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
  if (!(await disclaimerCheckbox.isChecked())) {
    await disclaimerLabel.click();
  }
  await expect(disclaimerCheckbox).toBeChecked();
  const saveButton = page.getByTestId('workspace-save');
  await expect(saveButton).toBeEnabled({ timeout: 15000 });
  await saveButton.click();
});
test('User can find and manage the form settings for a workspace', async ({ page }) => {
  await page.getByRole('tab', { name: 'Form Settings', exact: true }).click();

  const audienceDrawer = page.getByTestId('accordion-workspace-audience');
  const audienceToggle = audienceDrawer.getByRole('button', { name: 'Form Audience', exact: true });
  await expect(audienceToggle).toBeVisible();
  if ((await audienceToggle.getAttribute('aria-expanded')) !== 'true') {
    await audienceToggle.click();
  }
  await expect(audienceToggle).toHaveAttribute('aria-expanded', 'true');

  const audiencePanel = audienceDrawer.getByRole('group').filter({
    has: page.getByRole('radiogroup', { name: 'Who can submit', exact: true }),
  });
  await expect(audiencePanel).toBeVisible();
  await expect(audiencePanel).toHaveAttribute('aria-hidden', 'false');

  const audienceModes = audiencePanel.getByRole('radiogroup', {
    name: 'Who can submit',
    exact: true,
  });
  await expect(audienceModes).toBeVisible();
  await expect(audienceModes).toHaveAttribute('aria-orientation', 'vertical');
  await expect(audienceModes.getByRole('radio')).toHaveCount(3);
  for (const name of ['Public', 'Protected', 'Members only']) {
    const radio = audienceModes.getByRole('radio', { name, exact: true });
    await expect(audienceModes.getByText(name, { exact: true })).toBeVisible();
    await expect(radio).toBeEnabled();
    await expect(radio).toBeChecked({ checked: name === 'Protected' });
  }

  const allowedLogins = audiencePanel.getByRole('group', { name: 'Allowed logins', exact: true });
  await expect(allowedLogins).toBeVisible();
  await expect(allowedLogins.getByRole('checkbox')).toHaveCount(2);
  for (const name of ['BCeID Business', 'IDIR - MFA']) {
    const checkbox = allowedLogins.getByRole('checkbox', { name, exact: true });
    await expect(allowedLogins.getByText(name, { exact: true })).toBeVisible();
    await expect(checkbox).toBeEnabled();
  }

  const audienceSave = audiencePanel.getByRole('button', { name: 'Save', exact: true });
  await expect(audienceSave).toBeVisible();
  await expect(audienceSave).toHaveAttribute('type', 'submit');
  await expect(audienceSave).toBeDisabled();
  const audienceCancel = audiencePanel.getByRole('button', { name: 'Cancel', exact: true });
  await expect(audienceCancel).toBeVisible();
  await expect(audienceCancel).toHaveAttribute('type', 'button');
  await expect(audienceCancel).toBeEnabled();

  const idirMfaCheckbox = allowedLogins.getByRole('checkbox', { name: 'IDIR - MFA', exact: true });
  const bceidBusinessCheckbox = allowedLogins.getByRole('checkbox', {
    name: 'BCeID Business',
    exact: true,
  });
  // A previous run may have saved BCeID. Start this validation with only IDIR selected.
  if (!(await idirMfaCheckbox.isChecked())) {
    await allowedLogins.getByText('IDIR - MFA', { exact: true }).click();
  }
  if (await bceidBusinessCheckbox.isChecked()) {
    await allowedLogins.getByText('BCeID Business', { exact: true }).click();
  }
  await expect(idirMfaCheckbox).toBeChecked();
  await expect(bceidBusinessCheckbox).not.toBeChecked();
  await allowedLogins.getByText('IDIR - MFA', { exact: true }).click();
  await expect(idirMfaCheckbox).not.toBeChecked();
  await expect(
    allowedLogins.getByText('Select at least one login.', { exact: true }),
  ).toBeVisible();
  await expect(audienceSave).toBeDisabled();

  await allowedLogins.getByText('BCeID Business', { exact: true }).click();
  await expect(bceidBusinessCheckbox).toBeChecked();
  await expect(
    allowedLogins.getByText('Select at least one login.', { exact: true }),
  ).not.toBeVisible();
  await expect(audienceSave).toBeEnabled();
  await audienceSave.click();
  await expect(
    page.getByText(dictionaries.form.settings.formSettingsDrawerSaveSuccessMessage, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(audienceSave).toBeDisabled();
});
test('User can manage post submission settings for a workspace', async ({ page }) => {
  await page.getByTestId('workspace-post-submission-tab').click();
  const emailDrawer = page.getByTestId('accordion-post-submission-email-addresses');
  const emailToggle = emailDrawer.getByRole('button', { expanded: false });
  if (await emailToggle.count()) await emailToggle.click();
  const emailCheckbox = page.getByTestId('post-submission-email-enabled');
  await expect(emailCheckbox).toBeVisible();
  if (await emailCheckbox.locator('input[type="checkbox"]').isChecked()) {
    await emailCheckbox.click();
  }
  const emailChips = page.getByTestId('post-submission-email-list').getByRole('row');
  while ((await emailChips.count()) > 0) {
    await emailChips.first().getByRole('button').click();
  }
  await expect(emailCheckbox.locator('input[type="checkbox"]')).not.toBeChecked();
  await emailCheckbox.click();
  await expect(emailCheckbox.locator('input[type="checkbox"]')).toBeChecked();
  await expect(page.getByText('No addresses yet.')).toBeVisible();
  await expect(page.locator('[slot="errorMessage"]')).toContainText(
    'Add at least one address, or turn these emails off.',
  );
  await page.locator('input[inputmode="email"]').fill('test');
  await page.locator('input[inputmode="email"]').press('Enter');
  await expect(
    page
      .getByTestId('post-submission-email-input')
      .getByText('Not a valid email address. Fix or remove the text in the field.'),
  ).toBeVisible();
  await page.locator('input[inputmode="email"]').fill('test@example.com');
  await expect(
    page.getByTestId('form-settings-post-submission-email-addresses-save'),
  ).toBeVisible();
  await expect(
    page.getByTestId('form-settings-post-submission-email-addresses-cancel'),
  ).toBeVisible();
  await page.getByTestId('form-settings-post-submission-email-addresses-save').click();
  await expect(page.getByText('Changes updated successfully.')).toBeVisible();
});
test('User can manage access tab settings for a workspace', async ({ page }) => {
  await page.getByTestId('workspace-access-tab').click();
  await expect(page.getByTestId('workspace-access-tab')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('textbox', { name: 'Search' })).toBeVisible();
  await page.getByTestId('search-ws-access-button').click();
  await page.getByRole('textbox', { name: 'Search' }).fill('nimya');
  await page.getByTestId('search-ws-access-button').click();
  await expect(page).toHaveURL((url) => url.searchParams.get('workspaceAccess.q') === 'nimya');
  const existingMember = page.getByRole('row').filter({
    has: page.getByRole('cell', { name: 'nimya.1.john@gov.bc.ca', exact: true }),
  });
  await expect(existingMember.or(page.getByTestId('datatable-empty'))).toBeVisible();
  const alreadyMember = (await existingMember.count()) > 0;
  if (!alreadyMember) {
    await expect(page.getByTestId('datatable-empty')).toHaveText(
      'No one in a group matches your search. Show all workspace members to search everyone.',
    );
  }
  const addPersonButton = page.getByTestId('add-ws-member-button');
  await expect(addPersonButton).toBeVisible();
  await addPersonButton.click();
  const emailDropdown = page.getByRole('button', { name: 'Email' });

  await expect(emailDropdown).toBeVisible();
  await expect(emailDropdown).toContainText('Email');
  await emailDropdown.click();
  // Expected dropdown values
  const expectedOptions = ['Email', 'First name', 'Last name', 'GUID'];

  // Get all dropdown options
  const dropdownOptions = page.getByRole('listbox').getByRole('option');

  // Verify option count
  await expect(dropdownOptions).toHaveCount(4);

  // Verify each option
  for (const option of expectedOptions) {
    await expect(page.getByRole('option', { name: option })).toBeVisible();
  }
  await expect(page.getByRole('option', { name: 'Email' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('option', { name: 'Email', exact: true }).click();
  await page.getByTestId('user-search-input').fill('nimya');

  await page.getByRole('option', { name: 'nimya.1.john@gov.bc.ca' }).click();
  await expect(page.getByTestId('member-submit-button')).not.toBeEnabled();

  const administrCheckbox = page
    .getByTestId('workspace-member-add-form')
    .getByRole('checkbox', { name: 'Form administrators', exact: true });
  await expect(administrCheckbox).toBeVisible();
  const submittersCheckbox = page.getByRole('checkbox', { name: 'Form submitters', exact: true });
  const submittersLabel = page
    .getByTestId('workspace-member-add-form')
    .getByText('Form submitters', { exact: true });
  await expect(submittersCheckbox).toBeVisible();
  await submittersLabel.click();
  //Unselect it
  await submittersLabel.click();
  await expect(page.getByText('Choose at least one group.')).toBeVisible();
  await expect(submittersCheckbox).not.toBeChecked();
  await expect(page.getByTestId('member-cancel-button')).toBeVisible();
  //select it again
  await submittersLabel.click();
  await expect(page.getByTestId('member-submit-button')).toBeEnabled();
  if (alreadyMember) {
    await page.getByTestId('member-cancel-button').click();
    await expect(page.getByTestId('workspace-member-add-form')).not.toBeVisible();
  } else {
    await page.getByTestId('member-submit-button').click();
    await expect(page.getByText('Person added successfully.')).toBeVisible();
  }
  // The search is still filtered to this person, so the owner is not in these results.
  const memberRow = existingMember;
  await expect(memberRow).toBeVisible();
  await expect(memberRow.getByRole('button', { name: 'Remove' })).toBeVisible();
  await expect(memberRow).toContainText('NIMJOHN');
  await expect(memberRow).toContainText('Viewer');
  if (!alreadyMember) await expect(memberRow).toContainText('Form submitters');
  await memberRow.getByRole('button', { name: 'Edit' }).click();
  const editForm = page.getByTestId('workspace-member-edit-form');
  if (await editForm.getByRole('checkbox', { name: 'Form submitters', exact: true }).isChecked()) {
    await editForm.getByText('Form submitters', { exact: true }).click();
  }
  if (
    !(await editForm
      .getByRole('checkbox', { name: 'Form administrators', exact: true })
      .isChecked())
  ) {
    await editForm.getByText('Form administrators', { exact: true }).click();
  }
  await expect(page.getByTestId('member-submit-button')).toBeEnabled();
  await page.getByTestId('member-submit-button').click();
  await expect(
    page.getByText(dictionaries.workspaces.access.updateSuccess, { exact: true }),
  ).toBeVisible();
  await expect(memberRow).toContainText('Form administrators');
  await memberRow.getByRole('button', { name: 'Remove' }).click();
  await page.getByTestId('confirm-modal-confirm').click();
  await expect(memberRow).not.toBeVisible();
  await expect(page.getByTestId('datatable-empty')).toBeVisible();
});
