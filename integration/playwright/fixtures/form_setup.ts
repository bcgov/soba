import { test as base } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { formSetupFile, type FormSetupData } from '../support/form_setup_data';

export { expect } from '@playwright/test';

type Fixtures = FormSetupData & { formSetup: FormSetupData };

export const test = base.extend<Fixtures>({
  formSetup: async ({}, use) => {
    // Written by form_creation.spec.ts in the form-creation dependency project.
    const data: FormSetupData = JSON.parse(await readFile(formSetupFile, 'utf8'));
    await use(data);
  },
  title: async ({ formSetup }, use) => {
    await use(formSetup.title);
  },
  workspaceName: async ({ formSetup }, use) => {
    await use(formSetup.workspaceName);
  },
  formUrl: async ({ formSetup }, use) => {
    await use(formSetup.formUrl);
  },
});
