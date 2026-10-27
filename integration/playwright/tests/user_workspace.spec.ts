import { test, expect } from '../fixtures/form_setup';
import dictionaries from '../../../frontend/dictionaries/en.json';

test('User can find and manage the form workspace', async ({ page, workspaceName }) => {
  // workspaceName is the value saved by form_creation.spec.ts after createForm().
  await page.goto('');
  // Let the landing-page redirect finish before starting another navigation.
  await expect(page).toHaveURL(/\/forms(?:\?|$)/);
  await expect(page.getByRole('table', { name: 'Forms', exact: true })).toBeVisible();
  await page.getByTestId('workspaces-nav').click();
  await expect(page).toHaveURL(/\/workspaces(?:\?|$)/);

  const search = page.getByTestId('search-workspaces-text').getByRole('textbox');
  await expect(search).toBeEditable();
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
test('User can find and manage the form settings for a workspace', async ({
  page,
  workspaceName,
}) => {
  await page.goto('');
  await expect(page).toHaveURL(/\/forms(?:\?|$)/);
  await expect(page.getByRole('table', { name: 'Forms', exact: true })).toBeVisible();
  await page.getByTestId('workspaces-nav').click();
  await expect(page).toHaveURL(/\/workspaces(?:\?|$)/);
  await page.getByTestId('search-workspaces-text').getByRole('textbox').fill(workspaceName);
  await page.getByTestId('search-workspaces-button').click();
  await expect(page).toHaveURL((url) => url.searchParams.get('workspaces.q') === workspaceName);

  const workspaceRow = page
    .getByRole('table')
    .getByRole('row')
    .filter({
      has: page.getByRole('button', { name: workspaceName, exact: true }),
    });
  await workspaceRow.getByRole('button', { name: 'Manage', exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/[^/?#]+$/);
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
    await expect(checkbox).toBeChecked({ checked: name === 'IDIR - MFA' });
  }

  const audienceSave = audiencePanel.getByRole('button', { name: 'Save', exact: true });
  await expect(audienceSave).toBeVisible();
  await expect(audienceSave).toHaveAttribute('type', 'submit');
  await expect(audienceSave).toBeDisabled();
  const audienceCancel = audiencePanel.getByRole('button', { name: 'Cancel', exact: true });
  await expect(audienceCancel).toBeVisible();
  await expect(audienceCancel).toHaveAttribute('type', 'button');
  await expect(audienceCancel).toBeEnabled();
});
