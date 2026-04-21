import { Page } from "@playwright/test";

export function formsettings() {
  if (!process.env.KEYCLOAK_USERNAME || !process.env.KEYCLOAK_PASSWORD) {
    throw new Error("Missing env variables");
  }

  return {
    depEnv: process.env.DEP_ENV,
    username: process.env.KEYCLOAK_USERNAME,
    password: process.env.KEYCLOAK_PASSWORD,
  };
}

export async function login(page: Page) {
  const { username, password } = formsettings();
  
  await page.goto("/");
  await page.click('[data-testid="login-button"]');
  
  // Fill in login credentials and submit
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  
  // Wait for redirect after login
  await page.waitForURL("**/");
}
