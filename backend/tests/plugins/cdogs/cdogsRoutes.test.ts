import express from 'express';
import request from 'supertest';
import type { PluginConfigReader } from '../../../src/core/config/pluginConfig';
import { coreErrorHandler } from '../../../src/core/middleware/errorHandler';
import { createCdogsRouter } from '../../../src/plugins/cdogs/cdogsRoutes';

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

function createApp(configValues: Record<string, string | undefined>): express.Express {
  const app = express();
  app.use('/api/v1/document-generation', createCdogsRouter(createPluginConfig(configValues)));
  app.use(coreErrorHandler);
  return app;
}

describe('CDOGS routes', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns 400 when version is unsupported', async () => {
    const app = createApp({ BASE_URL: 'https://cdogs.example.com' });

    const response = await request(app).get('/api/v1/document-generation/v9/health');

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Unsupported document generation version');
  });

  it('proxies health response to caller', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('healthy', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      }),
    ) as jest.Mock;

    const app = createApp({ BASE_URL: 'https://cdogs.example.com' });

    const response = await request(app).get('/api/v1/document-generation/v2/health');

    expect(response.status).toBe(200);
    expect(response.text).toBe('healthy');
    expect(String((global.fetch as jest.Mock).mock.calls[0]?.[0])).toBe(
      'https://cdogs.example.com/api/v2/health',
    );
  });

  it('proxies template upload payload and template hash header', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('created', {
        status: 201,
        headers: {
          'Content-Type': 'text/plain',
          'X-Template-Hash': 'abc123',
        },
      }),
    ) as jest.Mock;

    const app = createApp({ BASE_URL: 'https://cdogs.example.com' });

    const payload = Buffer.from('template-binary');
    const response = await request(app)
      .post('/api/v1/document-generation/v3/template')
      .set('Content-Type', 'application/octet-stream')
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.text).toBe('created');
    expect(response.header['x-template-hash']).toBe('abc123');

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(fetchCall?.[0])).toBe('https://cdogs.example.com/api/v3/template');
    expect(fetchCall?.[1]?.body instanceof Uint8Array).toBe(true);
  });
});
