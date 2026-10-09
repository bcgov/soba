import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  addSobaSubmissionNote,
  deleteSobaSubmission,
  getSobaSubmissionReview,
  recordSobaSubmissionEdit,
  selectWorkspace,
  updateSobaSubmissionStatus,
} from '@/src/shared/api/sobaApi';

function mockResponse() {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({
      id: 'w1',
      name: 'WS',
      kind: 'personal',
      role: 'owner',
      status: 'active',
    }),
  } as unknown as Response;
}

describe('selectWorkspace', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GETs /workspaces/:id with the bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse());
    vi.stubGlobal('fetch', fetchMock);

    const result = await selectWorkspace('tok', 'w1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/workspaces/w1');
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(result.id).toBe('w1');
  });
});

function deleteResponse(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => {
      if (body === undefined) throw new SyntaxError('Unexpected end of JSON input');
      return body;
    },
  } as unknown as Response;
}

describe('deleteSobaSubmission', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('DELETEs the design route and resolves on a 204 with no body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(deleteResponse(204));
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteSobaSubmission('tok', 's1')).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/design/submissions/s1');
    expect(init.method).toBe('DELETE');
  });

  it('treats a 404 as already deleted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(deleteResponse(404, { error: 'Not found' })));

    await expect(deleteSobaSubmission('tok', 's1')).resolves.toBeUndefined();
  });

  it('throws the backend message on a 403', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(deleteResponse(403, { error: 'Insufficient form permissions' })),
    );

    await expect(deleteSobaSubmission('tok', 's1')).rejects.toThrow(
      'Insufficient form permissions',
    );
  });
});

describe('submission review calls', () => {
  const REVIEW = { assignees: [], statusHistory: [], notes: [], editHistory: [] };
  const reviewResponse = () =>
    ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => REVIEW,
    }) as unknown as Response;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch() {
    const fetchMock = vi.fn().mockResolvedValue(reviewResponse());
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('reads the review of one submission', async () => {
    const fetchMock = stubFetch();

    const result = await getSobaSubmissionReview('tok', 's1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/design\/submissions\/s1\/review$/);
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(result).toEqual(REVIEW);
  });

  it('posts a status change with its assignee', async () => {
    const fetchMock = stubFetch();
    const body = { status: 'ASSIGNED', assignee: 'Grace Hopper' } as const;

    await updateSobaSubmissionStatus('tok', 's1', body);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/design\/submissions\/s1\/review\/status$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(body);
  });

  it('posts a note as its text', async () => {
    const fetchMock = stubFetch();

    await addSobaSubmissionNote('tok', 's1', 'Needs a second look');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/design\/submissions\/s1\/review\/notes$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ text: 'Needs a second look' });
  });

  it('posts an edit record with no body', async () => {
    const fetchMock = stubFetch();

    await recordSobaSubmissionEdit('tok', 's1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/design\/submissions\/s1\/review\/edits$/);
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });
});
