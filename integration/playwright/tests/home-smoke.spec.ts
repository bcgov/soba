import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("page exposes core accessibility landmarks and skip navigation", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.locator("main#main-content")).toBeVisible();
  const skipLink = page.locator('a[href="#main-content"]').first();
  await expect(skipLink).toBeAttached();
  await skipLink.focus();
  await expect(skipLink).toBeVisible();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main-content")).toBeFocused();
});

test("home page has no critical a11y violations", async ({ page }) => {
  await page.goto("/");

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  const severeViolations = accessibilityScanResults.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  expect(severeViolations).toEqual([]);
});
