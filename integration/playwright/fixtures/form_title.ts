import { test as base, expect } from "@playwright/test";

type MyFixtures = {
  title: string;
};

export const test = base.extend<MyFixtures>({
  title: async ({}, use) => {
    const value = "chefs2-" + Math.random().toString(16).slice(2);
    await use(value);
  },
});

export { expect };
