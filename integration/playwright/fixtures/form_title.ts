import { test as base, expect } from "@playwright/test";

type MyFixtures = {
  title: string;
};

export const test = base.extend<MyFixtures>({
  title: async ({}, use) => {
    const value = `chefs2-${Date.now()}`;
    await use(value);
  },
});

export { expect };
