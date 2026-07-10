import express from 'express';
import request from 'supertest';
import type { PluginConfigReader } from '../../../src/core/config/pluginConfig';
import { pluginApiDefinition } from '../../../src/plugins/cdogs';

function createPluginConfig(values: Record<string, string | undefined>): PluginConfigReader {
  return {
    getRequired: (key: string) => {
      const value = values[key];
      if (!value) {
        throw new Error(`Missing required key: ${key}`);
      }
      return value;
    },
    getOptional: (key: string, defaultValue?: string) => values[key] ?? defaultValue,
    getBoolean: () => {
      throw new Error('Not used in test');
    },
    getNumber: () => {
      throw new Error('Not used in test');
    },
    getCsv: () => {
      throw new Error('Not used in test');
    },
  };
}

describe('CDOGS plugin definition', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('exports plugin API definition metadata', () => {
    expect(pluginApiDefinition.code).toBe('cdogs');
    expect(pluginApiDefinition.basePath).toBe('/document-generation');
    expect(typeof pluginApiDefinition.createRouter).toBe('function');
  });

  it('creates a router that serves health endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('ok', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      }),
    ) as jest.Mock;

    const app = express();
    app.use(
      pluginApiDefinition.basePath,
      pluginApiDefinition.createRouter(
        createPluginConfig({
          BASE_URL: 'https://cdogs.example.com',
        }),
      ),
    );

    const response = await request(app).get('/document-generation/v2/health');

    expect(response.status).toBe(200);
    expect(response.text).toBe('ok');
  });
});
