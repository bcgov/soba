import express from 'express';
import request from 'supertest';
import { parseUpload } from '../../../src/features/files/parseUpload';
import { coreErrorHandler } from '../../../src/core/middleware/errorHandler';

function uploadApp(): express.Express {
  const app = express();
  app.post('/upload', parseUpload(4), (req, res) => {
    const files = (req as express.Request & { files?: { originalname: string }[] }).files ?? [];
    res.json({ files: files.map((f) => f.originalname), submissionId: req.body?.submissionId });
  });
  app.use(coreErrorHandler);
  return app;
}

const MALFORMED = { error: 'Malformed multipart body' };

describe('parseUpload', () => {
  const app = uploadApp();

  it('parses a file under any field name, with the form fields', async () => {
    const res = await request(app)
      .post('/upload')
      .field('submissionId', 'sub1')
      .attach('anyKey', Buffer.from('abc'), 'a.txt');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ files: ['a.txt'], submissionId: 'sub1' });
  });

  it('passes a request that is not multipart through unparsed', async () => {
    const res = await request(app).post('/upload').send({ submissionId: 'sub1' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ files: [] });
  });

  it('returns 413 for a file over the size limit', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('file', Buffer.from('too many bytes'), 'big.txt');
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'File too large' });
  });

  it('returns 400 for any other multer limit, such as a second file', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('first', Buffer.from('a'), 'a.txt')
      .attach('second', Buffer.from('b'), 'b.txt');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Too many files' });
  });

  it('returns 400 for a multipart body with no boundary', async () => {
    const res = await request(app)
      .post('/upload')
      .set('Content-Type', 'multipart/form-data')
      .send('not multipart');
    expect(res.status).toBe(400);
    expect(res.body).toEqual(MALFORMED);
  });

  it('returns 400 for a truncated multipart body', async () => {
    const res = await request(app)
      .post('/upload')
      .set('Content-Type', 'multipart/form-data; boundary=XYZ')
      .send('--XYZ\r\nContent-Disposition: form-data; name="file"; filename="a.txt"\r\n\r\nab');
    expect(res.status).toBe(400);
    expect(res.body).toEqual(MALFORMED);
  });
});
