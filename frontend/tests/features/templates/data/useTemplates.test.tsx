import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TemplateResponse } from '@/src/types/templates';

const { mockUseAuthedSWR, mockMutate, mockList, mockUpload, mockDelete, mockDownload } = vi.hoisted(
  () => ({
    mockUseAuthedSWR: vi.fn(),
    mockMutate: vi.fn(),
    mockList: vi.fn(),
    mockUpload: vi.fn(),
    mockDelete: vi.fn(),
    mockDownload: vi.fn(),
  }),
);

vi.mock('@/src/shared/api/useAuthedSWR', () => ({ useAuthedSWR: mockUseAuthedSWR }));
vi.mock('@/src/features/templates/data/api', () => ({
  listTemplates: mockList,
  uploadTemplate: mockUpload,
  deleteTemplate: mockDelete,
  downloadTemplate: mockDownload,
}));

import { useTemplates } from '@/src/features/templates/data/useTemplates';

const template: TemplateResponse = {
  id: 'template-1',
  formId: 'form-1',
  formVersionId: 'version-1',
  name: 'Annual report',
  filename: 'annual-report.docx',
  contentType: null,
  size: null,
  createdBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedBy: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('useTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutate.mockResolvedValue(undefined);
    mockUseAuthedSWR.mockReturnValue({
      data: { items: [template] },
      error: undefined,
      isLoading: false,
      mutate: mockMutate,
    });
  });

  it('loads templates under the selected form-version key', async () => {
    const { result } = renderHook(() => useTemplates('version-1'));

    expect(result.current.templates).toEqual([template]);
    expect(result.current.loading).toBe(false);
    expect(mockUseAuthedSWR.mock.calls[0][0]).toEqual(['form-version-templates', 'version-1']);

    const fetcher = mockUseAuthedSWR.mock.calls[0][1] as (token: string) => Promise<unknown>;
    await fetcher('token');
    expect(mockList).toHaveBeenCalledWith('token', 'version-1');
  });

  it('uploads then revalidates the version list', async () => {
    const { result } = renderHook(() => useTemplates('version-1'));
    const file = new File(['contents'], 'template.docx');

    await act(async () => result.current.upload('token', 'Annual report', file));

    expect(mockUpload).toHaveBeenCalledWith('token', 'version-1', 'Annual report', file);
    expect(mockMutate).toHaveBeenCalledOnce();
  });

  it('deletes then revalidates the version list', async () => {
    const { result } = renderHook(() => useTemplates('version-1'));

    await act(async () => result.current.remove('token', 'template-1'));

    expect(mockDelete).toHaveBeenCalledWith('token', 'template-1');
    expect(mockMutate).toHaveBeenCalledOnce();
  });

  it('does not read or upload without a form version', async () => {
    mockUseAuthedSWR.mockReturnValueOnce({
      data: undefined,
      error: undefined,
      isLoading: false,
      mutate: mockMutate,
    });
    const { result } = renderHook(() => useTemplates(null));

    expect(mockUseAuthedSWR.mock.calls[0][0]).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.templates).toEqual([]);

    await act(async () => result.current.upload('token', 'Annual report', new File([], 'x.docx')));
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
