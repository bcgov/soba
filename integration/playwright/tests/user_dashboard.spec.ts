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
    // The user dropdown only renders once authenticated, so it confirms login
    await expect(
      sharedPage.locator('[data-testid="user-dropdown"]'),
    ).toBeVisible();
  });

  test("Checks the navigation links", async () => {
    // The SideNav is always visible for authenticated users (no menu toggle).
    await expect(
      sharedPage.locator('[data-testid="forms-nav"]'),
    ).toBeVisible();
    await expect(
      sharedPage.locator('[data-testid="feedback-nav"]'),
    ).toBeVisible();
    await expect(
      sharedPage.locator('[data-testid="help-nav"]'),
    ).toBeVisible();
  });
});
