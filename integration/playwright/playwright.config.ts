import { defineConfig } from "@playwright/test";
import * as dotenv from "dotenv";
import path from "path"; // <-- import dotenv

// Load .env reliably
dotenv.config({ path: path.resolve(__dirname, ".env") });
const depEnv = process.env.DEP_ENV || "dev"; // fallback to dev if undefined

// The app is served under a path, so baseURL has to keep it and end with a slash: without the
// slash a relative goto resolves to the parent, and a leading-slash goto drops the path entirely.
function withTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

function getExpectedURL(depEnv?: string): string {
  if (process.env.BASE_URL) {
    return withTrailingSlash(process.env.BASE_URL);
  }

  // PR environments (numeric) share the dev host; the path tells them apart.
  if (/^\d+$/.test(process.env.DEP_ENV || "")) {
    return `https://soba-dev.apps.silver.devops.gov.bc.ca/designer-${depEnv}/`;
  }

  switch (depEnv) {
    case "dev":
      return "https://soba-dev.apps.silver.devops.gov.bc.ca/designer/";
    case "test":
      return "https://soba-test.apps.silver.devops.gov.bc.ca/designer/";
    default:
      throw new Error(`Invalid DEP_ENV: ${depEnv}`);
  }
}

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,

  use: {
    baseURL: getExpectedURL(depEnv),
    headless: true,
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    ignoreHTTPSErrors: true,
  },

  reporter: [["html", { open: "never" }]],
  outputDir: "test-results",

  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
