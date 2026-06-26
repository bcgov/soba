import { test, expect } from "../fixtures/form_title";
import type { Page } from "@playwright/test";
import { login } from "../support/soba_login";

let sharedPage: Page;
let form_name: string;

test.describe.serial("Landing page tests", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    sharedPage = await context.newPage();
  });

  test.afterAll(async () => {
    //Logout after tests — logout lives inside the user dropdown, so open it first
    await sharedPage.click('[data-testid="user-dropdown"]');
    await sharedPage.click('[data-testid="logout-button"]');
    await sharedPage.context().close();
  });

  test("Validate form designing page", async ({ title }) => {
    await sharedPage.goto("/");
    await expect(
      sharedPage.locator('[data-testid="login-button"]'),
    ).toBeVisible();
    await login(sharedPage);
    await sharedPage.waitForTimeout(1000); // waits 1 second
    //Form creation
    await sharedPage.click('[data-testid="create-form-button"]');
    //save button is not enabled
    await expect(
      sharedPage.locator("button.btn.btn-outline-primary", { hasText: "Save" }),
    ).not.toBeEnabled();
    await sharedPage.locator("#formName").fill(title);
    form_name = title;
    console.log("Form name is: " + form_name);
    await sharedPage.waitForTimeout(1000);
  });
  test("Checks form creation", async () => {
    const source = sharedPage.locator("text=Text Field"); // component from builder palette
    const target = sharedPage.locator(".builder-components.drag-container");
    await source.dragTo(target);
    await sharedPage.click('button[ref="saveButton"]');
    await sharedPage.waitForTimeout(1000); // waits 1 second
    await expect(
      sharedPage.locator('label[for="disclaimer-checkbox"]'),
    ).toHaveText("I agree to the disclaimer and statement of responsibility");
    await sharedPage.locator("#disclaimer-checkbox").click();
    await expect(
      sharedPage.locator("button.btn.btn-outline-primary", { hasText: "Save" }),
    ).toBeEnabled();
    await sharedPage
      .locator("button.btn.btn-outline-primary", { hasText: "Save" })
      .click();
    await sharedPage.waitForTimeout(1000);
  });
  //form validation by searching the form
  test("search form", async () => {
    await sharedPage.click('[data-testid="forms-nav"]');
    await sharedPage
      .locator('[data-testid="search-forms-text"]')
      .fill(form_name);
    await sharedPage.waitForTimeout(1000); // waits 1 second
    await sharedPage.getByText(form_name).click();
    console.log("Form name is: " + form_name);
    await sharedPage.waitForTimeout(3000);
    //Validate form is created by checking form name
    await expect(sharedPage.getByPlaceholder("Enter form name")).toHaveValue(
      form_name,
    );
  });
});
