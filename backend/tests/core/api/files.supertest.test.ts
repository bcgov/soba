import express from 'express';
import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Mock submissionsApiService to avoid hitting DB in this unit-style integration test
jest.mock('../../../src/core/api/submissions/service', () => ({
  submissionsApiService: {
    create: jest.fn().mockResolvedValue({ id: 's1' }),
    save: jest.fn().mockResolvedValue({ id: 's1' }),
  },
}));

import { filesRouter } from '../../../src/core/api/files/route';

describe('files API (integration) - local-storage plugin', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'files-api-test-'));
  process.env.PLUGIN_LOCAL_STORAGE_BASE_PATH = tmp;

  const app = express();
  app.use(express.json());
  app.use('/files', filesRouter);

  it('uploads and lists and downloads a file', async () => {
    const uploadRes = await request(app)
      .post('/files/local-storage')
      .field('formVersionId', 'fv1')
      .field('formId', 'f1')
      .attach('file', Buffer.from('abc'), 'a.txt');
    if (uploadRes.status !== 200) {
      // log response to help debugging
      console.error('UPLOAD ERROR BODY:', uploadRes.body);
    }
    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body).toHaveProperty('url');
    expect(uploadRes.body.url.length).toBeGreaterThan(0);
    const engineFileRef = uploadRes.body.id;

    const listRes = await request(app).get('/files/local-storage');
    expect(listRes.status).toBe(200);
    expect(listRes.body.items.length).toBeGreaterThan(0);

    const downloadRes = await request(app).get(
      `/files/local-storage/${encodeURIComponent(engineFileRef)}`,
    );
    // either redirect or stream; we accept 200 or 302
    expect([200, 302].includes(downloadRes.status)).toBe(true);

    const delRes = await request(app).delete(
      `/files/local-storage/${encodeURIComponent(engineFileRef)}`,
    );
    expect([200, 204, 302].includes(delRes.status)).toBe(true);
  });
});
