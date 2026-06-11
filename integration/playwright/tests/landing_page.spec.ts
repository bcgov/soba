import { test, expect, Page } from "@playwright/test";
import { login } from "../support/soba_login";

let sharedPage: Page;

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

  test("Checks the login functionality", async () => {
    await sharedPage.goto("/");
    await expect(
      sharedPage.locator('[data-testid="login-button"]'),
    ).toBeVisible();
    await login(sharedPage);
    await expect(
      sharedPage.locator('[data-testid="nav-menu-button"]'),
    ).toBeVisible();
  });

  test("Checks the navigation links", async () => {
    await sharedPage.locator('[data-testid="nav-menu-button"]').click();
    const designLink = sharedPage.locator('a[href="/en/designer"]');
    await designLink.isVisible();
    const formsLink = sharedPage.locator('a[href="/en/forms"]');
    await formsLink.isVisible();
    const APIMetaLink = sharedPage.locator('a[href="/en/meta"]');
    await APIMetaLink.isVisible();
  });
});
