import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { SWRConfig } from 'swr';

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));

vi.mock('@/app/[lang]/Providers', async () => {
  const dict = { ...(await import('@/dictionaries/en.json')).default, locale: 'en' };
  return { useDictionary: () => dict };
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/build/f1/submissions/exports',
  useRouter: () => ({ push: mockPush }),
}));

const getSobaForm = vi.fn();
const lookupFormVersions = vi.fn();
const getSobaExportFields = vi.fn();
const listSobaSubmissionExports = vi.fn();
const startSobaSubmissionExport = vi.fn();

vi.mock('@/src/shared/api/sobaApi', () => ({
  getSobaForm: (...args: unknown[]) => getSobaForm(...args),
  lookupFormVersions: (...args: unknown[]) => lookupFormVersions(...args),
  getSobaExportFields: (...args: unknown[]) => getSobaExportFields(...args),
  listSobaSubmissionExports: (...args: unknown[]) => listSobaSubmissionExports(...args),
  startSobaSubmissionExport: (...args: unknown[]) => startSobaSubmissionExport(...args),
}));

import makeStore from '@/lib/store';
import { setAuthenticated, setToken } from '@/lib/slices/keycloakSlice';
import { ApiError } from '@/src/shared/api/sobaHelpers';
import { PageLayout } from '@/src/components/PageLayout';
import { SubmissionExport } from '@/src/features/designer/ui/SubmissionExport';
import type { SubmissionExport as SubmissionExportRecord } from '@/src/types/submissionExport';

const FIELDS = ['form.confirmationId', 'applicantName', 'applicantEmail'];
const FIRST_LAYOUT = 'multiRowEmptySpacesCSVExport';

const QUEUED: SubmissionExportRecord = {
  id: 'e1',
  formId: 'f1',
  formVersionId: 'v2',
  format: 'csv',
  layout: FIRST_LAYOUT,
  status: 'queued',
  createdAt: '2026-10-20T17:12:44.000Z',
};

async function renderExport() {
  const store = makeStore();
  store.dispatch(setToken('token'));
  store.dispatch(setAuthenticated(true));
  await act(async () => {
    render(
      <Provider store={store}>
        <SWRConfig
          value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}
        >
          <PageLayout headingId="submission-export-heading" heading="Export submissions">
            <SubmissionExport formId="f1" />
          </PageLayout>
        </SWRConfig>
      </Provider>,
    );
  });
}

async function openExport() {
  await renderExport();
  await screen.findByTestId('export-form');
  await screen.findByTestId('export-fields');
}

const radio = (name: string) => screen.getByRole('radio', { name }) as HTMLInputElement;
const exportButton = () => screen.getByTestId('export-submit') as HTMLButtonElement;
const lastFieldsFilters = () => getSobaExportFields.mock.calls.at(-1)?.[2];
const startBody = () => startSobaSubmissionExport.mock.calls.at(-1)?.[2];

const click = async (element: Element) => {
  await act(async () => {
    fireEvent.click(element);
  });
};

/** Types a date into a picker's segments, in the order the picker shows them. */
async function typeDate(testId: string, parts: { year: string; month: string; day: string }) {
  const user = userEvent.setup();
  for (const segment of within(screen.getByTestId(testId)).getAllByRole('spinbutton')) {
    const label = segment.getAttribute('aria-label')?.toLowerCase() ?? '';
    const key = (['year', 'month', 'day'] as const).find((name) => label.includes(name));
    if (!key) continue;
    await user.click(segment);
    await user.keyboard(parts[key]);
  }
}

const segmentValues = (testId: string) =>
  within(screen.getByTestId(testId))
    .getAllByRole('spinbutton')
    .map((segment) => segment.getAttribute('aria-valuenow'));

async function chooseRange() {
  await click(radio('Date range'));
  await typeDate('export-from', { year: '2025', month: '10', day: '01' });
  await typeDate('export-to', { year: '2025', month: '10', day: '05' });
}

// To is inclusive on screen, so the upper bound is the start of the next day.
const RANGE = {
  from: new Date('2025-10-01T00:00:00').toISOString(),
  to: new Date('2025-10-06T00:00:00').toISOString(),
};

describe('SubmissionExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSobaForm.mockResolvedValue({ id: 'f1', name: 'Housing Needs (sample)' });
    lookupFormVersions.mockResolvedValue({
      items: [
        { id: 'v1', versionNo: 1, state: 'archived' },
        { id: 'v2', versionNo: 2, state: 'published' },
      ],
    });
    getSobaExportFields.mockResolvedValue({ fields: FIELDS });
    listSobaSubmissionExports.mockResolvedValue({ items: [] });
    startSobaSubmissionExport.mockResolvedValue(QUEUED);
  });

  it('starts as CSV, all versions and all dates, and says the page shows sample data', async () => {
    await openExport();

    expect(radio('CSV').checked).toBe(true);
    expect(radio('All').checked).toBe(true);
    expect(screen.getByTestId('export-version')).toHaveTextContent('All versions');
    expect(screen.queryByTestId('export-range')).toBeNull();
    expect(lastFieldsFilters()).toEqual({ layout: FIRST_LAYOUT });
    expect(screen.getByTestId('page-notice-submission-export-sample')).toHaveTextContent(
      'sample data',
    );
  });

  it('hides the layout and field list for JSON, and sends neither', async () => {
    await openExport();

    await click(radio('JSON'));
    await waitFor(() => expect(exportButton()).not.toBeDisabled());

    expect(screen.queryByTestId('export-layout')).toBeNull();
    expect(screen.queryByTestId('export-fields')).toBeNull();
    expect(lastFieldsFilters()).toEqual({});
    await click(exportButton());
    expect(startBody()).toEqual({ format: 'json' });
  });

  it('hides the field list for the unformatted layout, and sends no fields', async () => {
    await openExport();

    await click(radio('4 - Unformatted'));
    await waitFor(() => expect(exportButton()).not.toBeDisabled());

    expect(screen.queryByTestId('export-fields')).toBeNull();
    await click(exportButton());
    expect(startBody()).toEqual({ format: 'csv', layout: 'unFormattedCSVExport' });
  });

  it('sends only the ticked fields', async () => {
    await openExport();

    await act(async () => {
      fireEvent.change(screen.getByRole('textbox', { name: 'Search fields' }), {
        target: { value: 'email' },
      });
    });
    expect(screen.queryByRole('checkbox', { name: 'applicantName' })).toBeNull();
    await click(screen.getByRole('checkbox', { name: 'applicantEmail' }));
    expect(screen.getByTestId('export-fields-count')).toHaveTextContent('2 of 3 fields selected');

    await click(exportButton());

    expect(startBody()).toEqual({
      format: 'csv',
      layout: FIRST_LAYOUT,
      fields: ['form.confirmationId', 'applicantName'],
    });
  });

  it('waits for both dates before reading or exporting a date range', async () => {
    await openExport();
    const reads = getSobaExportFields.mock.calls.length;

    await click(radio('Date range'));

    expect(screen.getByTestId('export-range')).toBeTruthy();
    expect(exportButton()).toBeDisabled();
    expect(getSobaExportFields.mock.calls).toHaveLength(reads);
  });

  it('keeps the dates when switching away from a date range and back, sending them only with it', async () => {
    await openExport();
    await chooseRange();
    await waitFor(() => expect(lastFieldsFilters()).toEqual({ layout: FIRST_LAYOUT, ...RANGE }));
    const entered = segmentValues('export-from');

    await click(radio('All'));
    expect(screen.queryByTestId('export-range')).toBeNull();
    await waitFor(() => expect(exportButton()).not.toBeDisabled());
    await click(exportButton());
    expect(startBody()).toEqual({ format: 'csv', layout: FIRST_LAYOUT, fields: FIELDS });

    await click(radio('Date range'));
    expect(segmentValues('export-from')).toEqual(entered);
    await waitFor(() => expect(exportButton()).not.toBeDisabled());
    await click(exportButton());
    expect(startBody()).toEqual({ format: 'csv', layout: FIRST_LAYOUT, fields: FIELDS, ...RANGE });
  });

  it('cannot export while the field list reloads after a filter change', async () => {
    await openExport();
    expect(exportButton()).not.toBeDisabled();
    getSobaExportFields.mockReturnValue(new Promise(() => {}));

    await click(radio('2 - Multiple rows per submission'));

    expect(exportButton()).toBeDisabled();
    expect(screen.queryByTestId('export-fields')).toBeNull();
  });

  it('says so when there are no exports yet', async () => {
    await openExport();

    expect(
      within(screen.getByTestId('export-list')).getByTestId('datatable-empty'),
    ).toHaveTextContent('You have not exported this form yet.');
  });

  it('lists a queued export with its status', async () => {
    listSobaSubmissionExports.mockResolvedValue({ items: [QUEUED] });
    await openExport();

    expect(await screen.findByTestId('export-status-e1')).toHaveTextContent('Queued');
    expect(screen.getByTestId('export-list')).toHaveTextContent('Version 2');
  });

  it('adds the started export to the list', async () => {
    await openExport();
    listSobaSubmissionExports.mockResolvedValue({ items: [QUEUED] });

    await click(exportButton());

    expect(startSobaSubmissionExport).toHaveBeenCalledWith('token', 'f1', expect.anything());
    expect(await screen.findByTestId('export-status-e1')).toHaveTextContent('Queued');
  });

  it('keeps the choices after a failed start', async () => {
    startSobaSubmissionExport.mockRejectedValue(new ApiError('boom', 500));
    await openExport();
    await click(screen.getByRole('checkbox', { name: 'applicantEmail' }));

    await click(exportButton());

    await waitFor(() => expect(exportButton()).not.toBeDisabled());
    expect(radio('CSV').checked).toBe(true);
    expect(screen.getByTestId('export-fields-count')).toHaveTextContent('2 of 3 fields selected');
    expect(screen.queryByTestId('export-status-e1')).toBeNull();
  });

  it('shows a failed field read', async () => {
    getSobaExportFields.mockRejectedValue(new ApiError('boom', 500));
    await renderExport();

    expect(await screen.findByTestId('export-fields-loaderror')).toHaveTextContent(
      'Could not load the fields.',
    );
    expect(exportButton()).toBeDisabled();
  });

  it('shows a refused field read as no access', async () => {
    getSobaExportFields.mockRejectedValue(new ApiError('nope', 403));
    await renderExport();

    expect(await screen.findByTestId('export-fields-loaderror')).toHaveTextContent(
      'You do not have access',
    );
  });

  it('shows a failed list read and still offers the filters', async () => {
    listSobaSubmissionExports.mockRejectedValue(new ApiError('boom', 500));
    await openExport();

    expect(await screen.findByTestId('export-list-loaderror')).toHaveTextContent(
      'Could not load your exports.',
    );
    expect(exportButton()).not.toBeDisabled();
  });

  it('shows a failed form read', async () => {
    getSobaForm.mockRejectedValue(new ApiError('boom', 500));
    await renderExport();

    expect(await screen.findByTestId('export-form-loaderror')).toHaveTextContent(
      'Could not load the form.',
    );
  });

  it('goes back to the submissions tab', async () => {
    await openExport();

    await click(screen.getByTestId('export-back'));

    expect(mockPush).toHaveBeenCalledWith('/en/build/f1?tab=submissions');
  });
});
