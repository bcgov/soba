import { test, expect } from "@playwright/test";

test("Visits the login page to validate the URL", async ({ page }) => {
  const depEnv = process.env.DEP_ENV;

  await page.goto("/");
  //Login button visibility
  await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
});
