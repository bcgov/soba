jest.mock('../../../src/core/db/repos/featureRepo', () => ({ isFeatureEnabledCached: jest.fn() }));
jest.mock('../../../src/core/db/repos/formRepo', () => ({ getWorkspaceIdForForm: jest.fn() }));
jest.mock('../../../src/core/db/repos/formAccessRepo', () => ({
  resolveFormPermissions: jest.fn(),
}));
jest.mock('../../../src/core/db/repos/workspaceCredentialRepo', () => ({
  findActiveApiCredential: jest.fn(),
}));
jest.mock('../../../src/integration/v2/exportService', () => ({
  integrationExportService: { open: jest.fn() },
}));
jest.mock('../../../src/integration/middleware/resolveCredential', () => ({
  resolveIntegrationCredential: (
    req: import('express').Request,
    _res: import('express').Response,
    next: import('express').NextFunction,
  ) => {
    if (!req.headers['gw-jwt']) return next(new UnauthorizedError());
    req.integrationCredential = credentialFixture();
    next();
  },
}));

import { credentialFixture, testIds } from '../fixtures/data';
import express from 'express';
import { Features } from '../../../src/core/db/codes';
import { isFeatureEnabledCached } from '../../../src/core/db/repos/featureRepo';
import { UnauthorizedError } from '../../../src/core/errors';
import request from 'supertest';
import { getWorkspaceIdForForm } from '../../../src/core/db/repos/formRepo';
import { resolveFormPermissions } from '../../../src/core/db/repos/formAccessRepo';
import { findActiveApiCredential } from '../../../src/core/db/repos/workspaceCredentialRepo';
import { integrationExportService } from '../../../src/integration/v2/exportService';
import { integrationV2Router } from '../../../src/integration/v2/routes';

const formId = testIds.form;
const url = `/forms/${formId}/submissions/export`;
const app = express();
app.use(integrationV2Router);
const key = credentialFixture;
const mockKey = (overrides: Parameters<typeof credentialFixture>[0] = {}) =>
  jest.mocked(findActiveApiCredential).mockResolvedValue(credentialFixture(overrides));
const get = (suffix = '') =>
  request(app)
    .get(url + suffix)
    .set('GW-JWT', 'verified-by-mocked-auth');
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(isFeatureEnabledCached).mockResolvedValue(true);
  mockKey();
  jest.mocked(getWorkspaceIdForForm).mockResolvedValue(testIds.workspace);
  jest.mocked(resolveFormPermissions).mockResolvedValue(new Set(['submission_read']));
  jest.mocked(integrationExportService.open).mockImplementation(async (_bounds, options) => ({
    contentType: options.format === 'json' ? 'application/json' : 'text/csv',
    extension: options.format,
    content: (async function* () {
      yield options.format === 'json' ? '[{"answer":"yes"}]' : 'answer\r\nyes\r\n';
    })(),
  }));
});

describe('Successful export responses', () => {
  it.each(['json', 'csv'])('exports %s with no-store and a download filename', async (format) => {
    const res = await get(`?format=${format}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain(
      format === 'json' ? 'application/json' : 'text/csv',
    );
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-disposition']).toContain(`submissions-${formId}.${format}`);
    expect(resolveFormPermissions).toHaveBeenCalledWith(testIds.creator, testIds.workspace, formId);
  });

  it('refuses a missing form', async () => {
    jest.mocked(getWorkspaceIdForForm).mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });
});

describe('Credential scope and permission checks', () => {
  it('defaults to JSON and accepts a key scoped to this form', async () => {
    mockKey({ formId });
    expect((await get()).status).toBe(200);
    expect(integrationExportService.open).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: testIds.workspace, formId }),
      expect.objectContaining({ format: 'json' }),
    );
  });

  it.each([{ workspaceId: testIds.otherWorkspace }, { formId: testIds.otherForm }])(
    'refuses resources outside key scope %j',
    async (overrides) => {
      mockKey(overrides);
      expect((await get()).status).toBe(404);
      expect(integrationExportService.open).not.toHaveBeenCalled();
    },
  );

  it('requires an active key', async () => {
    jest.mocked(findActiveApiCredential).mockResolvedValue(null);
    expect((await get()).status).toBe(401);
    expect(integrationExportService.open).not.toHaveBeenCalled();
  });

  it('refuses a key without submission_read', async () => {
    mockKey({ permissions: [] });
    expect((await get()).status).toBe(403);
    expect(integrationExportService.open).not.toHaveBeenCalled();
  });

  it('refuses when the creator lost access or a form override denies access', async () => {
    jest.mocked(resolveFormPermissions).mockResolvedValue(new Set());
    expect((await get()).status).toBe(403);
    expect(integrationExportService.open).not.toHaveBeenCalled();
  });

  it('checks revocation again before returning the buffered export', async () => {
    jest.mocked(findActiveApiCredential).mockResolvedValueOnce(key()).mockResolvedValue(null);
    expect((await get()).status).toBe(401);
  });

  it('requires gateway authentication', async () => {
    expect((await request(app).get(url)).status).toBe(401);
    expect(integrationExportService.open).not.toHaveBeenCalled();
  });
});

describe('Query validation and date filters', () => {
  it.each([
    '?format=xml',
    '?from=bad',
    '?unknown=1',
    '?from=2026-01-02T00:00:00Z&to=2026-01-01T00:00:00Z',
  ])('rejects invalid query %s', async (query) => {
    expect((await get(query)).status).toBe(400);
    expect(integrationExportService.open).not.toHaveBeenCalled();
  });

  it('rejects a future lower bound after capping to at now', async () => {
    expect((await get('?from=2999-01-01T00:00:00Z')).status).toBe(400);
  });

  it('passes date and version filters to the bounded form query', async () => {
    await get(`?from=2020-01-01T00:00:00Z&to=2021-01-01T00:00:00Z&formVersionId=${formId}`);
    expect(integrationExportService.open).toHaveBeenCalledWith(
      expect.objectContaining({
        from: new Date('2020-01-01'),
        to: new Date('2021-01-01'),
        formVersionId: formId,
      }),
      expect.anything(),
    );
  });

  it('caps future end dates at now using the shared designer export bounds', async () => {
    const before = Date.now();
    expect((await get('?to=2999-01-01T00:00:00Z')).status).toBe(200);
    const bounds = jest.mocked(integrationExportService.open).mock.calls[0][0];
    expect(bounds.to.getTime()).toBeGreaterThanOrEqual(before);
    expect(bounds.to.getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe('Response integrity and size limits', () => {
  it('returns no partial file if an engine document is missing', async () => {
    jest.mocked(integrationExportService.open).mockImplementationOnce(async (_b, options) => {
      options.onUnread(1);
      return {
        contentType: 'application/json',
        extension: 'json',
        content: (async function* () {
          yield '[]';
        })(),
      };
    });
    expect((await get()).status).toBe(503);
  });

  it('rejects oversized JSON without sending a partial file', async () => {
    jest.mocked(integrationExportService.open).mockResolvedValueOnce({
      contentType: 'application/json',
      extension: 'json',
      content: (async function* () {
        yield 'x'.repeat(10 * 1024 * 1024 + 1);
      })(),
    });
    expect((await get()).status).toBe(413);
  });

  it('maps the CSV serializer size limit to 413', async () => {
    jest
      .mocked(integrationExportService.open)
      .mockRejectedValueOnce(new Error('Result over the size limit of 1 bytes'));
    expect((await get('?format=csv')).status).toBe(413);
  });
});

describe('Feature availability', () => {
  it.each(['json', 'csv'])(
    'returns 404 without opening a %s export when the feature is disabled',
    async (format) => {
      jest.mocked(isFeatureEnabledCached).mockResolvedValue(false);
      const response = await get(`?format=${format}`);
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('route_not_found');
      expect(isFeatureEnabledCached).toHaveBeenCalledWith(
        Features.submission_export,
        expect.any(Number),
      );
      expect(integrationExportService.open).not.toHaveBeenCalled();
    },
  );

  it('does not return the buffered file if the feature is turned off during export', async () => {
    jest.mocked(isFeatureEnabledCached).mockResolvedValueOnce(true).mockResolvedValue(false);
    const response = await get();
    expect(response.status).toBe(404);
    expect(response.headers['content-disposition']).toBeUndefined();
    expect(response.body.code).toBe('route_not_found');
  });

  it('rechecks the feature before the next database page', async () => {
    jest.mocked(isFeatureEnabledCached).mockResolvedValueOnce(true).mockResolvedValue(false);
    jest.mocked(integrationExportService.open).mockImplementationOnce(async (_bounds, options) => {
      await options.authorize!();
      throw new Error('Must not start a page after the feature is disabled');
    });
    expect((await get()).status).toBe(404);
  });

  it('authorizes the caller before checking feature availability', async () => {
    mockKey({ permissions: [] });
    expect((await get()).status).toBe(403);
    expect(isFeatureEnabledCached).not.toHaveBeenCalled();
  });
});

describe('Timeout and disconnect handling', () => {
  it('applies the export deadline during the initial permission lookup', async () => {
    const deadline = new AbortController();
    const timeout = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
    jest.mocked(resolveFormPermissions).mockImplementationOnce(() => {
      deadline.abort(new Error('deadline'));
      return new Promise<Set<string>>(() => {});
    });
    try {
      const response = await get();
      expect(response.status).toBe(503);
      expect(response.text).toContain('Export timed out');
      expect(integrationExportService.open).not.toHaveBeenCalled();
    } finally {
      timeout.mockRestore();
    }
  });

  it('stops waiting for a serializer that ignores the deadline', async () => {
    const deadline = new AbortController();
    const timeout = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
    const close = jest.fn().mockResolvedValue({ done: true });
    jest.mocked(integrationExportService.open).mockResolvedValueOnce({
      contentType: 'application/json',
      extension: 'json',
      content: {
        [Symbol.asyncIterator]: () => ({
          next: () => {
            deadline.abort(new Error('deadline'));
            return new Promise<IteratorResult<string>>(() => {});
          },
          return: close,
        }),
      },
    });
    try {
      expect((await get()).status).toBe(503);
      expect(close).toHaveBeenCalled();
    } finally {
      timeout.mockRestore();
    }
  });

  it('aborts the export reader when the HTTP client disconnects', async () => {
    let started!: () => void;
    const readerStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    let observedAbort!: () => void;
    const aborted = new Promise<void>((resolve) => {
      observedAbort = resolve;
    });
    let readerSignal: AbortSignal | undefined;
    jest.mocked(integrationExportService.open).mockImplementationOnce(async (_bounds, options) => {
      readerSignal = options.signal;
      options.signal.addEventListener('abort', observedAbort, { once: true });
      started();
      return new Promise<Awaited<ReturnType<typeof integrationExportService.open>>>(() => {});
    });
    const server = app.listen(0);
    try {
      const req = request(server).get(url).set('GW-JWT', 'verified-by-mocked-auth');
      const response = req.then(
        () => undefined,
        () => undefined,
      );
      await readerStarted;
      req.abort();
      await aborted;
      await response;
      expect(readerSignal?.aborted).toBe(true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
