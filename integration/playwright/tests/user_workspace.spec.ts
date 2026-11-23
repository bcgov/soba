import { randomUUID } from 'node:crypto';
import { test, expect } from '../fixtures/form_setup';
import dictionaries from '../../../frontend/dictionaries/en.json';
import { openAuthenticatedPage } from '../support/open_authenticated_page';

test.describe.configure({ timeout: 60_000 });

test.beforeEach(async ({ page, baseURL, workspaceName }) => {
  if (!baseURL) throw new Error('Playwright baseURL must be configured');
  await openAuthenticatedPage(page, `${baseURL.replace(/\/$/, '')}/workspaces`);
  await expect(page).toHaveURL(/\/workspaces(?:\?|$)/);
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
test('User can validate job status, type and form dropdowns for a workspace', async ({ page }) => {
  const jobsTab = page.getByTestId('workspace-jobs-tab');
  await jobsTab.click();
  await expect(jobsTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText(dictionaries.jobs.workspaceIntro, { exact: true })).toBeVisible();

  const statusDropdown = page.getByTestId('jobs-status-filter').getByRole('button');
  await statusDropdown.click();
  await expect(statusDropdown).toHaveAttribute('aria-expanded', 'true');

  const listbox = page.getByRole('listbox');
  const expectedStatuses = [
    'All statuses',
    'Queued',
    'Running',
    'Succeeded',
    'Failed',
    'Cancelled',
  ];
  await expect(listbox.getByRole('option')).toHaveText(expectedStatuses);
  for (const status of expectedStatuses) {
    await expect(listbox.getByRole('option', { name: status, exact: true })).toBeVisible();
  }

  await listbox.press('Escape');
  await expect(statusDropdown).toHaveAttribute('aria-expanded', 'false');

  const typeDropdown = page.getByTestId('jobs-type-filter').getByRole('button');
  await typeDropdown.click();
  await expect(typeDropdown).toHaveAttribute('aria-expanded', 'true');
  await expect(listbox).toBeVisible();

  // Deployments with Submit to Email list both the action and its delivery step.
  const submitToEmailTypes = ['Submit to Email', 'Submit to Email: emails'];
  const hasSubmitToEmail = await listbox
    .getByRole('option', { name: submitToEmailTypes[0], exact: true })
    .isVisible();

  const expectedTypes = [
    dictionaries.jobs.allTypes,
    dictionaries.jobs.types.submissionSubmitted,
    dictionaries.postSubmission.email.label,
    ...(hasSubmitToEmail ? submitToEmailTypes : []),
    dictionaries.postSubmission.log.label,
    dictionaries.jobs.types.submissionStatusChanged,
    dictionaries.jobs.types.submissionStatusEmail,
    dictionaries.jobs.types.submissionEmailCopy,
  ];
  await expect(listbox.getByRole('option')).toHaveText(expectedTypes);
  for (const type of expectedTypes) {
    await expect(listbox.getByRole('option', { name: type, exact: true })).toBeVisible();
  }

  await listbox.press('Escape');
  await expect(typeDropdown).toHaveAttribute('aria-expanded', 'false');

  const formsDropdown = page.getByTestId('jobs-form-filter').getByRole('button');
  await formsDropdown.click();
  await expect(formsDropdown).toHaveAttribute('aria-expanded', 'true');

  const allFormsOption = listbox.getByRole('option', {
    name: dictionaries.jobs.allForms,
    exact: true,
  });
  await expect(allFormsOption).toBeVisible();
  await allFormsOption.click();
  await expect(formsDropdown).toContainText(dictionaries.jobs.allForms);
  await expect(formsDropdown).toHaveAttribute('aria-expanded', 'false');

  const resetFiltersButton = page.getByTestId('jobs-clear-filters');
  await expect(resetFiltersButton).toBeVisible();
  await expect(resetFiltersButton).toBeEnabled();
});

test('User can manage access drawer settings for a workspace', async ({ page }) => {
  const accessTab = page
    .getByTestId('workspace-permissions-tab')
    .or(page.getByTestId('workspace-access-tab'));
  await accessTab.click();
  await expect(accessTab).toHaveAttribute('aria-selected', 'true');

  const accessContent = page
    .getByTestId('workspace-access-drawer-content')
    .or(page.getByTestId('workspace-access-tab-content'));
  const searchBox = accessContent.getByRole('textbox', { name: /search/i });
  const searchButton = accessContent.getByTestId('search-ws-access-button');
  await expect(searchBox).toBeVisible();
  await searchButton.click();
  await searchBox.fill('nimya');
  await searchButton.click();
  await expect(page).toHaveURL((url) => url.searchParams.get('workspaceAccess.q') === 'nimya');
  const existingMember = accessContent.getByRole('row').filter({
    has: page.getByRole('cell', { name: 'nimya.1.john@gov.bc.ca', exact: true }),
  });
  const emptyTable = accessContent.getByTestId('datatable-empty');
  await expect(existingMember.or(emptyTable)).toBeVisible();
  const alreadyMember = (await existingMember.count()) > 0;
  if (!alreadyMember) {
    await expect(emptyTable).toHaveText(
      'No one in a group matches your search. Show all workspace members to search everyone.',
    );
  }
  const addPersonButton = accessContent.getByTestId('add-ws-member-button');
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
  const removeMember = memberRow.getByTestId(/^remove-member-button-/);
  await expect(memberRow).toBeVisible();
  await expect(removeMember).toBeVisible();
  await expect(memberRow).toContainText('NIMJOHN');
  await expect(memberRow).toContainText('Viewer');
  if (!alreadyMember) await expect(memberRow).toContainText('Form submitters');
  await memberRow.getByTestId(/^edit-member-button-/).click();
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
  await removeMember.click();
  await page.getByTestId('confirm-modal-confirm').click();
  await expect(memberRow).not.toBeVisible();
  await expect(emptyTable).toBeVisible();
});

test.describe('Workspace roles', () => {
  const roleLabels = dictionaries.workspaces.roles;

  test.beforeEach(async ({ page }) => {
    const permissionsTab = page.getByTestId('workspace-permissions-tab');
    const rolesTab = permissionsTab.or(page.getByTestId('workspace-roles-tab'));
    await rolesTab.click();
    await expect(rolesTab).toHaveAttribute('aria-selected', 'true');

    if (await permissionsTab.isVisible()) {
      const rolesToggle = page
        .getByTestId('accordion-workspace-roles')
        .getByRole('button', { name: dictionaries.workspaces.rolesTab, exact: true });
      if ((await rolesToggle.getAttribute('aria-expanded')) !== 'true') await rolesToggle.click();
      await expect(rolesToggle).toHaveAttribute('aria-expanded', 'true');
    }
  });

  test('User can view a fixed workspace role', async ({ page }) => {
    const fixedRole = page.getByRole('row').filter({
      has: page.getByTestId('role-name-form_admin'),
    });
    await expect(fixedRole.getByTestId('role-type-form_admin')).toHaveText(roleLabels.types.fixed);
    await expect(fixedRole.getByTestId('role-permissions-form_admin')).toHaveText(
      roleLabels.allPermissions,
    );
    await fixedRole.getByTestId('view-role-button-form_admin').click();

    const form = page.getByTestId('workspace-role-edit-form');
    await expect(form.getByTestId('fixed-role-alert')).toBeVisible();
    await expect(form.getByRole('textbox', { name: roleLabels.name })).toBeDisabled();
    await expect(form.getByTestId('role-submit-button')).toHaveCount(0);
    await form.getByTestId('role-cancel-button').click();
    await expect(form).toBeHidden();
  });

  test('User can create and remove a custom workspace role', async ({ page }) => {
    const roleName = `E2E Role ${randomUUID().slice(0, 8)}`;
    const rolesContent = page
      .getByTestId('workspace-roles-drawer-content')
      .or(page.getByTestId('workspace-roles-tab-content'));
    await rolesContent.getByRole('textbox', { name: /search/i }).fill(roleName);
    await rolesContent.getByTestId('search-ws-roles-button').click();
    await expect(rolesContent.getByTestId('datatable-empty')).toHaveText(roleLabels.empty);
    await rolesContent.getByTestId('create-ws-role-button').click();

    const form = rolesContent.getByTestId('workspace-role-create-form');
    await form.getByRole('textbox', { name: roleLabels.name }).fill(roleName);
    const create = form.getByTestId('role-submit-button');
    await expect(create).toBeDisabled();
    await form.getByText(roleLabels.permissionNames.form_read, { exact: true }).click();
    await expect(create).toBeEnabled();

    const roleRow = rolesContent.getByRole('row').filter({
      has: page.getByRole('cell', { name: roleName, exact: true }),
    });
    try {
      await create.click();
      await expect(roleRow).toBeVisible();
      await expect(roleRow.getByTestId(/^role-type-/)).toHaveText(roleLabels.types.custom);
      await expect(roleRow.getByTestId(/^role-permissions-/)).toHaveText(
        roleLabels.permissionCountOne,
      );
    } finally {
      if (await roleRow.isVisible()) {
        await roleRow.getByTestId(/^delete-role-button-/).click();
        await page.getByTestId('confirm-modal-confirm').click();
        await expect(roleRow).toHaveCount(0);
      }
    }
  });
});
