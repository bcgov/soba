import { test, expect } from "@playwright/test";

test("Visits the login page to validate the URL", async ({ page }) => {
  await page.goto("/");
  //Login button visibility
  await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
});
