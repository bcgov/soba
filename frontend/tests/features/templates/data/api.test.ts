import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockSobaFetch } = vi.hoisted(() => ({ mockSobaFetch: vi.fn() }));

vi.mock('@/src/shared/api/sobaFetch', () => ({ sobaFetch: mockSobaFetch }));

import {
  deleteTemplate,
  downloadTemplate,
  listTemplates,
  uploadTemplate,
} from '@/src/features/templates/data/api';

function response(body: unknown = {}, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    blob: async () => new Blob(['template bytes']),
  } as unknown as Response;
}

describe('templates API', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lists templates for a form version', async () => {
    mockSobaFetch.mockResolvedValue(response({ items: [] }));

    await expect(listTemplates('token', 'version-1')).resolves.toEqual({ items: [] });
    expect(mockSobaFetch).toHaveBeenCalledWith('/templates', {
      token: 'token',
      query: { formVersionId: 'version-1' },
    });
  });

  it('uploads the name and file as multipart data', async () => {
    mockSobaFetch.mockResolvedValue(response({ id: 'template-1' }, 201));
    const file = new File(['report'], 'report.docx');

    await uploadTemplate('token', 'version-1', 'Annual report', file);

    const [path, options] = mockSobaFetch.mock.calls[0];
    expect(path).toBe('/templates');
    expect(options.token).toBe('token');
    expect(options.method).toBe('POST');
    expect(options.query).toEqual({ formVersionId: 'version-1' });
    expect(options.form).toBeInstanceOf(FormData);
    expect(options.form.get('name')).toBe('Annual report');
    expect(options.form.get('file')).toBe(file);
  });

  it('deletes a template', async () => {
    mockSobaFetch.mockResolvedValue(response(null, 204));

    await expect(deleteTemplate('token', 'template-1')).resolves.toBeUndefined();
    expect(mockSobaFetch).toHaveBeenCalledWith('/templates/template-1', {
      token: 'token',
      method: 'DELETE',
    });
  });

  it('downloads the template content as a blob', async () => {
    mockSobaFetch.mockResolvedValue(response());

    const blob = await downloadTemplate('token', 'template-1');

    expect(mockSobaFetch).toHaveBeenCalledWith('/templates/template-1/content', { token: 'token' });
    expect(blob).toBeInstanceOf(Blob);
  });

  it.each([
    ['delete', () => deleteTemplate('token', 'template-1')],
    ['download', () => downloadTemplate('token', 'template-1')],
  ])('surfaces a failed %s response', async (_operation, call) => {
    mockSobaFetch.mockResolvedValue(response({}, 500));

    await expect(call()).rejects.toMatchObject({ status: 500 });
  });
});
