import { test, expect, Page } from "@playwright/test";
import { login } from "../support/soba_login";

let sharedPage: Page;

test.describe.serial("Landing page tests", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    sharedPage = await context.newPage();
  });

  test.afterAll(async () => {
    //Logout after tests
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
    const designerLink = sharedPage.getByRole("link", { name: "Designer" });
    await expect(designerLink).toBeVisible();
    await expect(designerLink).toHaveAttribute("href", "/en/designer");
    const SubmitLink = sharedPage.getByRole("link", { name: "Submit" });
    await expect(SubmitLink).toBeVisible();
    await expect(SubmitLink).toHaveAttribute("href", "/en/submit");
    const APIMetaLink = sharedPage.getByRole("link", { name: "API meta" });
    await expect(APIMetaLink).toBeVisible();
    await expect(APIMetaLink).toHaveAttribute("href", "/en/meta");
  });
});
