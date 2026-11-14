jest.mock('../../../src/core/db/repos/submissionExportRepo', () => ({
  isVersionOfForm: jest.fn(),
}));
jest.mock('../../../src/features/submission-export/engineSource', () => ({
  exportSchemas: jest.fn().mockResolvedValue([
    {
      versionId: 'v1',
      schema: { components: [{ key: 'answer', type: 'textfield', input: true }] },
    },
  ]),
  formAnswerReader: jest.fn().mockResolvedValue(jest.fn()),
  engineExportSource: jest.fn(),
}));
jest.mock('../../../src/features/submission-export/submissionQuery', () => ({
  submissionExportQuery: {},
}));

import { isVersionOfForm } from '../../../src/core/db/repos/submissionExportRepo';
import { engineExportSource } from '../../../src/features/submission-export/engineSource';
import { integrationExportService } from '../../../src/integration/v2/exportService';

const bounds = { workspaceId: 'w1', formId: 'f1', to: new Date() };
const options = () => ({
  format: 'csv' as const,
  fields: ['answer'],
  signal: new AbortController().signal,
  maxBytes: 1024,
  onUnread: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
  (engineExportSource as jest.Mock).mockReturnValue({
    rows: async function* () {
      yield { versionId: 'v1', answers: { answer: 'hello, world' } };
    },
  });
});

it('streams CSV using the existing serializer and selected fields', async () => {
  const result = await integrationExportService.open(bounds, options());
  let text = '';
  for await (const chunk of result.content) text += chunk;
  expect(result.contentType).toBe('text/csv');
  expect(text).toBe('\uFEFFanswer\r\n"hello, world"\r\n');
});

it('rejects a version from another form before opening the source', async () => {
  (isVersionOfForm as jest.Mock).mockResolvedValue(false);
  await expect(
    integrationExportService.open({ ...bounds, formVersionId: 'other-version' }, options()),
  ).rejects.toThrow('That version is not one of this form');
  expect(engineExportSource).not.toHaveBeenCalled();
});

it('enforces the caller size limit while serializing', async () => {
  const result = await integrationExportService.open(bounds, { ...options(), maxBytes: 1 });
  await expect(async () => {
    for await (const chunk of result.content) void chunk;
  }).rejects.toThrow();
});

it('stops an aborted request before opening the source', async () => {
  const controller = new AbortController();
  controller.abort(new Error('Client disconnected'));
  await expect(
    integrationExportService.open(bounds, { ...options(), signal: controller.signal }),
  ).rejects.toThrow('Client disconnected');
  expect(engineExportSource).not.toHaveBeenCalled();
});
