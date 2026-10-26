import express from 'express';
import request from 'supertest';

jest.mock('../../../../src/core/api/submissions/service', () => ({
  submissionsApiService: { submit: jest.fn() },
}));

import { submitSubmission } from '../../../../src/core/api/submissions/controller';
import { submissionsApiService } from '../../../../src/core/api/submissions/service';

const submit = submissionsApiService.submit as jest.Mock;

const app = express();
// Behind a trusted proxy the client IP comes from X-Forwarded-For.
app.set('trust proxy', true);
app.use(express.json());
app.use((req, _res, next) => {
  req.coreContext = { actorId: 'u1', workspaceId: 'ws1' } as unknown as NonNullable<
    typeof req.coreContext
  >;
  next();
});
app.post('/submissions/:id/submit', submitSubmission);

describe('submitSubmission client', () => {
  beforeEach(() => submit.mockReset().mockResolvedValue({ id: 's1' }));

  it("passes the submitter's IP and user agent to the service", async () => {
    const response = await request(app)
      .post('/submissions/s1/submit')
      .set('X-Forwarded-For', '203.0.113.7')
      .set('User-Agent', 'Mozilla/5.0 (sample)')
      .send({ data: {} });

    expect(response.status).toBe(200);
    expect(submit).toHaveBeenCalledWith(expect.anything(), 's1', expect.anything(), {
      ip: '203.0.113.7',
      userAgent: 'Mozilla/5.0 (sample)',
    });
  });

  it('passes a null user agent when the browser sends none', async () => {
    await request(app).post('/submissions/s1/submit').unset('User-Agent').send({ data: {} });

    expect(submit.mock.calls[0][3]).toEqual({ ip: expect.any(String), userAgent: null });
  });
});
