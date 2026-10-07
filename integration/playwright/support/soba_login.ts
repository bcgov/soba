import { expect, type Page } from "@playwright/test";
import { authenticator } from "@otplib/preset-default";
export function formsettings() {
  if (
    !process.env.KEYCLOAK_USERNAME ||
    !process.env.KEYCLOAK_PASSWORD ||
    !process.env.MFA_CODE
  ) {
    throw new Error(
      "Missing env variables: KEYCLOAK_USERNAME, KEYCLOAK_PASSWORD, and MFA_CODE are required",
    );
  }

  return {
    depEnv: process.env.DEP_ENV,
    username: process.env.KEYCLOAK_USERNAME,
    password: process.env.KEYCLOAK_PASSWORD,
    mfaCode: process.env.MFA_CODE,
  };
}

export async function login(page: Page) {
  const { username, password, mfaCode } = formsettings();

  await page.getByTestId("login-button").click();
  await expect(page.locator("#social-azureidir")).toBeVisible();
  await expect(page.locator("#social-bceidbusiness")).toBeVisible();

  await page.locator("#social-azureidir").click();
  await page.fill('input[type="email"]', username);
  await page.click('input[type="submit"]');
  await page.fill('input[name="passwd"]', password);
  await page.click('input[type="submit"]');

  authenticator.options = {
    step: 30,
    window: 2,
  };

  const token = authenticator.generate(mfaCode);
  console.log("Generated OTP:", token);
  await page.fill('input[name="otc"]', token);
  await page.click('input[type="submit"]');
  await page.locator("#idSIButton9").click();
  await expect(page.locator('[data-testid="user-dropdown"]')).toBeVisible();
}
