import { parseWorkspacePluginsConfig } from '../../../src/core/config/workspacePlugins';
import { createEnvReader } from '../../../src/core/config/env';

describe('workspacePlugins', () => {
  it('parseWorkspacePluginsConfig returns allowedPlugins and strictMode from simulated env', () => {
    const reader = createEnvReader({
      WORKSPACE_PLUGINS_ALLOWED: 'personal-local, enterprise-cstar',
      WORKSPACE_PLUGINS_STRICT_MODE: 'true',
    });
    const config = parseWorkspacePluginsConfig(reader);
    expect(config.allowedPlugins).toEqual(['personal-local', 'enterprise-cstar']);
    expect(config.strictMode).toBe(true);
  });

  it('parseWorkspacePluginsConfig strictMode false when WORKSPACE_PLUGINS_STRICT_MODE is false', () => {
    const reader = createEnvReader({
      WORKSPACE_PLUGINS_ALLOWED: 'personal-local',
      WORKSPACE_PLUGINS_STRICT_MODE: 'false',
    });
    const config = parseWorkspacePluginsConfig(reader);
    expect(config.strictMode).toBe(false);
  });

  it('parseWorkspacePluginsConfig trims and splits WORKSPACE_PLUGINS_ALLOWED', () => {
    const reader = createEnvReader({
      WORKSPACE_PLUGINS_ALLOWED: '  a , b , c  ',
      WORKSPACE_PLUGINS_STRICT_MODE: 'true',
    });
    const config = parseWorkspacePluginsConfig(reader);
    expect(config.allowedPlugins).toEqual(['a', 'b', 'c']);
  });

  it('parseWorkspacePluginsConfig throws when WORKSPACE_PLUGINS_STRICT_MODE is not true or false', () => {
    const reader = createEnvReader({
      WORKSPACE_PLUGINS_ALLOWED: 'personal-local',
      WORKSPACE_PLUGINS_STRICT_MODE: 'yes',
    });
    expect(() => parseWorkspacePluginsConfig(reader)).toThrow(
      /WORKSPACE_PLUGINS_STRICT_MODE must be 'true' or 'false'/,
    );
  });

  it('parseWorkspacePluginsConfig throws when WORKSPACE_PLUGINS_ALLOWED is empty', () => {
    const reader = createEnvReader({
      WORKSPACE_PLUGINS_ALLOWED: '',
      WORKSPACE_PLUGINS_STRICT_MODE: 'true',
    });
    expect(() => parseWorkspacePluginsConfig(reader)).toThrow(
      /WORKSPACE_PLUGINS_ALLOWED is required/,
    );
  });

  it('parseWorkspacePluginsConfig throws when WORKSPACE_PLUGINS_ALLOWED is only commas/whitespace', () => {
    const reader = createEnvReader({
      WORKSPACE_PLUGINS_ALLOWED: '  , , ',
      WORKSPACE_PLUGINS_STRICT_MODE: 'true',
    });
    expect(() => parseWorkspacePluginsConfig(reader)).toThrow(
      /WORKSPACE_PLUGINS_ALLOWED must include at least one plugin code/,
    );
  });

  it('parseWorkspacePluginsConfig accepts single plugin code', () => {
    const reader = createEnvReader({
      WORKSPACE_PLUGINS_ALLOWED: 'personal-local',
      WORKSPACE_PLUGINS_STRICT_MODE: 'false',
    });
    const config = parseWorkspacePluginsConfig(reader);
    expect(config.allowedPlugins).toEqual(['personal-local']);
  });
});
