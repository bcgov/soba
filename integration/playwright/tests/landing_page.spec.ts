import { test, expect } from "@playwright/test";
import { login } from "../support/soba_login";

test("Visits the login page to validate the URL", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
  await login(page);
});
