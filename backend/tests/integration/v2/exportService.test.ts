jest.mock('../../../src/core/db/repos/submissionExportRepo', () => ({
  isVersionOfForm: jest.fn(),
}));
jest.mock('../../../src/features/submission-export/engineSource', () => ({
  exportSchemas: jest.fn(),
  formAnswerReader: jest.fn(),
  engineExportSource: jest.fn(),
}));
jest.mock('../../../src/features/submission-export/submissionQuery', () => ({
  submissionExportQuery: { pages: jest.fn() },
}));

import { exportRowFixture, testIds } from '../fixtures/data';
import { submissionExportQuery } from '../../../src/features/submission-export/submissionQuery';
import { isVersionOfForm } from '../../../src/core/db/repos/submissionExportRepo';
import {
  engineExportSource,
  exportSchemas,
  formAnswerReader,
} from '../../../src/features/submission-export/engineSource';
import { integrationExportService } from '../../../src/integration/v2/exportService';

const bounds = {
  workspaceId: testIds.workspace,
  formId: testIds.form,
  to: new Date('2026-01-02T00:00:00Z'),
};
const options = () => ({
  format: 'csv' as const,
  fields: ['answer'],
  signal: new AbortController().signal,
  maxBytes: 1024,
  onUnread: jest.fn(),
});

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(exportSchemas).mockResolvedValue([
    {
      versionId: testIds.version,
      schema: {
        components: [{ key: 'answer', type: 'textfield', input: true }],
      },
    },
  ]);
  jest.mocked(formAnswerReader).mockResolvedValue(jest.fn());
  jest.mocked(engineExportSource).mockReturnValue({
    count: jest.fn(),
    rows: async function* () {
      yield exportRowFixture();
    },
  });
});

const collect = async (content: AsyncIterable<string>) => {
  let text = '';
  for await (const chunk of content) text += chunk;
  return text;
};

describe('Serialization and schema completeness', () => {
  it('streams CSV using the existing serializer and selected fields', async () => {
    const result = await integrationExportService.open(bounds, options());
    let text = '';
    for await (const chunk of result.content) text += chunk;
    expect(result.contentType).toBe('text/csv');
    expect(text).toBe('\uFEFFanswer\r\n"hello, world"\r\n');
  });

  it('enforces the caller size limit while serializing', async () => {
    const result = await integrationExportService.open(bounds, { ...options(), maxBytes: 1 });
    await expect(async () => {
      for await (const chunk of result.content) void chunk;
    }).rejects.toThrow();
  });

  it('refuses CSV answer loss when every schema is missing', async () => {
    jest.mocked(exportSchemas).mockResolvedValueOnce([]);
    const result = await integrationExportService.open(bounds, options());
    await expect(collect(result.content)).rejects.toThrow(
      'Some submission schemas are unavailable',
    );
  });

  it('does not use another version’s matching fields as a fallback for CSV', async () => {
    jest.mocked(engineExportSource).mockReturnValueOnce({
      count: jest.fn(),
      rows: async function* () {
        yield exportRowFixture({ answers: { answer: 'valid first row' } });
        yield exportRowFixture({
          versionId: 'missing-version',
          answers: { answer: 'must not be silently omitted' },
        });
      },
    });
    const result = await integrationExportService.open(bounds, options());
    await expect(collect(result.content)).rejects.toThrow(
      'Some submission schemas are unavailable',
    );
  });

  it('still exports JSON answers when the version schema is unavailable', async () => {
    jest.mocked(exportSchemas).mockResolvedValueOnce([]);
    const result = await integrationExportService.open(bounds, { ...options(), format: 'json' });
    expect(JSON.parse(await collect(result.content))).toEqual([
      expect.objectContaining({ answer: 'hello, world' }),
    ]);
  });

  it('allows an empty CSV export when there are no submissions or schemas', async () => {
    jest.mocked(exportSchemas).mockResolvedValueOnce([]);
    jest
      .mocked(engineExportSource)
      .mockReturnValueOnce({ count: jest.fn(), rows: async function* () {} });
    const result = await integrationExportService.open(bounds, { ...options(), fields: undefined });
    expect(await collect(result.content)).toContain('form.submissionId');
  });
});

describe('Form version validation', () => {
  it('rejects a version from another form before opening the source', async () => {
    jest.mocked(isVersionOfForm).mockResolvedValue(false);
    await expect(
      integrationExportService.open({ ...bounds, formVersionId: 'other-version' }, options()),
    ).rejects.toThrow('That version is not one of this form');
    expect(engineExportSource).not.toHaveBeenCalled();
  });
});

describe('Cancellation and page authorization', () => {
  it('stops an aborted request before opening the source', async () => {
    const controller = new AbortController();
    controller.abort(new Error('Client disconnected'));
    await expect(
      integrationExportService.open(bounds, { ...options(), signal: controller.signal }),
    ).rejects.toThrow('Client disconnected');
    expect(engineExportSource).not.toHaveBeenCalled();
  });

  it('rechecks authorization before fetching a submission page', async () => {
    const authorize = jest.fn().mockRejectedValue(new Error('Access revoked'));
    await integrationExportService.open(bounds, { ...options(), authorize });
    const query = jest.mocked(engineExportSource).mock.calls[0][0];
    const next = jest.fn().mockResolvedValue({ done: true });
    jest.mocked(submissionExportQuery.pages).mockReturnValue({
      [Symbol.asyncIterator]: () => ({ next }),
    });
    const pages = query
      .pages(bounds, { pageSize: 100, signal: options().signal })
      [Symbol.asyncIterator]();
    await expect(pages.next()).rejects.toThrow('Access revoked');
    expect(next).not.toHaveBeenCalled();
  });
});
