import { formSettingsModules } from '../../../src/features/form-settings/registry';

describe('form settings registry', () => {
  it('lists every group lowest weight first', () => {
    const weights = formSettingsModules.map((module) => module.weight);
    expect([...weights].sort((a, b) => a - b)).toEqual(weights);
  });

  it('gives every group its own URL segment', () => {
    const keys = formSettingsModules.map((module) => module.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  // Reading the registry must not build routers: dev-data purge imports it for the table list.
  it('leaves a router unbuilt until it is mounted', () => {
    for (const module of formSettingsModules) {
      expect(typeof module.router).toBe('function');
    }
  });

  it('declares the tables purge has to clear', () => {
    for (const module of formSettingsModules) {
      expect(module.tables.length).toBeGreaterThan(0);
    }
  });
});
