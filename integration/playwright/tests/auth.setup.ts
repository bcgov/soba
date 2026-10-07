import { test as setup } from "@playwright/test";
import fs from "fs";
import path from "path";
import { login } from "../support/soba_login";

const authFile = path.resolve(__dirname, "../support/user.json");

setup("authenticate", async ({ page }) => {
  await page.goto("");
  await login(page);

  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  // Save cookies, localStorage, etc.
  await page.context().storageState({ path: authFile });
});
