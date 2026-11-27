import { errors, expect, type Page } from '@playwright/test';

export async function openAuthenticatedPage(page: Page, url: string) {
  const userMenu = page.getByTestId('user-dropdown');
  const navigate = () => page.goto(url, { waitUntil: 'domcontentloaded' });

  try {
    await navigate();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('net::ERR_CONNECTION_REFUSED')) {
      throw error;
    }

    await navigate();
  }

  try {
    await userMenu.waitFor({ state: 'visible', timeout: 15_000 });
  } catch (error) {
    if (!(error instanceof errors.TimeoutError)) throw error;

    // Restart the silent Keycloak sign-in if it stalled during page bootstrap.
    await navigate();
    await expect(userMenu).toBeVisible({ timeout: 20_000 });
  }
}
