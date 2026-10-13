import { test, expect } from "../fixtures/form_title";
import type { Locator, Page } from "@playwright/test";
import dictionaries from "../../../frontend/dictionaries/en.json";

// Load the authenticated session.
test.use({
  storageState: "support/user.json",
});

async function createForm({ page, title }: { page: Page; title: string }) {
  await page.goto("");

  // Check whether initial workspace setup is required.
  const workspaceModal = page
    .locator(".bcds-react-aria-Modal")
    .filter({ hasText: "Default Workspace Setup" });

  if (await workspaceModal.isVisible().catch(() => false)) {
    await page
      .getByTestId("workspace-name")
      .locator("input")
      .fill("Test Workspace");

    await page.getByTestId("workspace-your-org").click();

    await page
      .getByRole("option", {
        name: "Health (HLTH)",
        exact: true,
      })
      .click();

    await page.getByTestId("workspace-use-case").click();

    const collectionUseCase = dictionaries.useCases["collection"];

    if (collectionUseCase) {
      const collectionOption = page.getByRole("option", {
        name: new RegExp(
          collectionUseCase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        ),
      });

      await collectionOption.click();
    }

    await page.getByTestId("workspace-disclaimer-switch").click();

    await expect(
      page.getByTestId("workspace-disclaimer-switch").locator("input"),
    ).toBeChecked();

    await page.getByTestId("workspace-save").click();
  }

  await page.getByTestId("forms-nav").click();
  await page.getByTestId("create-form-button").click();

  const createFormDialog = page.getByRole("dialog", { name: "Create Form" });
  const workspaceSelector = createFormDialog.getByRole("button", {
    name: "Select an item",
  });
  await expect(workspaceSelector).toBeVisible();
  await workspaceSelector.click();

  const workspaceOption = page.getByRole("option", {
    name: "Test Workspace (team)",
    exact: true,
  });
  await expect(workspaceOption).toBeVisible();
  await workspaceOption.click();

  const formNameInput = createFormDialog
    .locator("label", { hasText: "Form Name" })
    .locator("xpath=following-sibling::div//input");
  await formNameInput.fill(title);
  await createFormDialog.getByTestId("save-create-form").click();
}

async function dragComponentToCanvas(component: Locator, target: Locator) {
  const targetBounds = await target.boundingBox();
  if (!targetBounds) {
    throw new Error("Form builder canvas is not measurable");
  }

  await component.dragTo(target, {
    targetPosition: {
      x: targetBounds.width / 2,
      y: Math.max(1, targetBounds.height - 10),
    },
  });
}

test("Create, edit, search, preview, and publish one form", async ({
  page,
  title,
}) => {
  test.setTimeout(120_000);

  await createForm({ page, title });
  const target = page.locator(".builder-components.drag-container");
  await expect(target).toBeVisible();

  const txt_box = page.locator("text=Text Field"); // component from builder palette
  await dragComponentToCanvas(txt_box, target);
  await page.click('button[ref="saveButton"]');
  await page.waitForTimeout(1000); // waits 1 second
  const text_area = page.getByText("Text Area", { exact: true }).first();
  await dragComponentToCanvas(text_area, target);
  await expect(page.locator('button[ref="saveButton"]')).toBeVisible({
    timeout: 5000,
  });
  await page.click('button[ref="saveButton"]');
  await page.waitForTimeout(1000); // waits 1 second
  const number = page.locator(
    'span[data-group="basic"][data-key="number"][data-type="number"]',
  );
  await dragComponentToCanvas(number, target);
  await page.click('button[ref="saveButton"]');
  await page.waitForTimeout(1000); // waits 1 second
  const password = page.locator(
    'span[data-group="basic"][data-key="password"][data-type="password"]',
  );
  await dragComponentToCanvas(password, target);
  await page.click('button[ref="saveButton"]');
  await page.waitForTimeout(1000); // waits 1 second
  const checkbox = page.locator(
    'span[data-group="basic"][data-key="checkbox"][data-type="checkbox"]',
  );
  await dragComponentToCanvas(checkbox, target);
  await page.click('button[ref="saveButton"]');
  await page.waitForTimeout(1000); // waits 1 second
  const selectboxes = page.locator(
    'span[data-group="basic"][data-key="selectboxes"][data-type="selectboxes"]',
  );
  await dragComponentToCanvas(selectboxes, target);
  await page.locator('a[href="#data"]').click();
  await page.locator('input[name="data[values][0][value]"]').fill("1");
  await page.click('button[ref="saveButton"]');
  await page.waitForTimeout(1000); // waits 1 second
  const select = page.locator(
    'span[data-group="basic"][data-key="select"][data-type="select"]',
  );
  await dragComponentToCanvas(select, target);
  await page.click('button[ref="saveButton"]');
  await page.waitForTimeout(1000); // waits 1 second
  const radio = page.locator(
    'span[data-group="basic"][data-key="radio"][data-type="radio"]',
  );
  await dragComponentToCanvas(radio, target);
  await page.locator('a[href="#data"]').click();
  await page.locator('input[name="data[values][0][value]"]').fill("1");
  await page.click('button[ref="saveButton"]');
  await page.waitForTimeout(1000); // waits 1 second
  const button = page.locator(
    'span[data-group="basic"][data-key="button"][data-type="button"]',
  );
  await dragComponentToCanvas(button, target);
  await page.click('button[ref="saveButton"]');
  await page.waitForTimeout(1000); // waits 1 second

  const saveButton = page.getByRole("button", {
    name: "Save",
    exact: true,
  });
  await saveButton.click({ force: true });
  await expect(
    page.getByText("Form saved successfully.", { exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1000);

  await page.getByTestId("forms-nav").click();

  const searchForms = page.getByTestId("search-forms-text");

  await expect(searchForms).toBeVisible({ timeout: 10000 });
  await searchForms.click();

  await searchForms.getByRole("textbox", { name: "Search" }).fill(title);

  await page.getByText(title, { exact: true }).click();

  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();

  await expect(page.getByText("Workspace: Test Workspace")).toHaveText(
    "Workspace: Test Workspace",
  );

  await expect(
    page.getByRole("button", { name: "Preview", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Preview", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: /Form Preview chefs2-/ }),
  ).toBeVisible();

  await expect(page.locator('input[name="data[textField]"]')).toBeVisible();
  await expect(page.locator('input[name="data[number]"]')).toBeVisible();
  await expect(page.locator('input[name="data[checkbox]"]')).toBeVisible();

  await page
    .getByRole("button", { name: "Close Preview", exact: true })
    .click();

  const publishButton = page.getByRole("button", {
    name: "Publish",
    exact: true,
  });

  await expect(publishButton).toBeVisible();
  await publishButton.click();

  await expect(
    page.getByText("Form published successfully!", { exact: true }),
  ).toBeVisible();

  const publishedNotice = page.getByTestId("page-notice-published-version");

  await expect(publishedNotice).toBeVisible();
  await expect(publishedNotice).toContainText("Published Version:");
  await expect(publishedNotice).toContainText(
    "This version is published and cannot be modified directly.",
  );

  await expect(publishButton).toBeDisabled();
});
