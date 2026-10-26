import { describe, it, expect, vi, afterEach } from 'vitest';
import { downloadSobaSubmissionFile, exportSobaSubmissions } from '@/src/shared/api/sobaApiDesign';

function fileResponse(disposition: string | null): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: (name: string) => (name === 'Content-Disposition' ? disposition : null) },
    blob: async () => new Blob(['x']),
  } as unknown as Response;
}

describe('design export downloads', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the export body and names the file from filename*', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        fileResponse(
          `attachment; filename="r_sum__submissions.csv"; filename*=UTF-8''r%C3%A9sum%C3%A9_submissions.csv`,
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const file = await exportSobaSubmissions('tok', 'f1', {
      dateMode: 'all',
      includeDrafts: false,
      template: 'singleRowCSVExport',
      format: 'csv',
      locale: 'en',
    });

    expect(file.filename).toBe('résumé_submissions.csv');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/design/forms/f1/export');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({ dateMode: 'all', format: 'csv' });
  });

  it('falls back to the plain filename, then to a generic name', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(fileResponse('attachment; filename="plan.pdf"'))
        .mockResolvedValueOnce(fileResponse(null)),
    );

    expect((await downloadSobaSubmissionFile('tok', 's1', 'file-1')).filename).toBe('plan.pdf');
    expect((await downloadSobaSubmissionFile('tok', 's1', 'file-1')).filename).toBe('download');
  });

  it('throws a refused download with its status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: { get: () => 'application/json' },
        json: async () => ({ error: { code: 'file_not_found', message: 'File not found' } }),
        text: async () => '{"error":{"code":"file_not_found","message":"File not found"}}',
      }),
    );

    await expect(downloadSobaSubmissionFile('tok', 's1', 'file-1')).rejects.toMatchObject({
      status: 404,
    });
  });
});
