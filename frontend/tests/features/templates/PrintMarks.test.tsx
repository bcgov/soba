import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => ({
    form: {
      templates: {
        print: {
          printedAt: 'Printed {time}',
          unsavedMark: 'Not saved',
          draftMark: 'Draft',
        },
      },
    },
  }),
}));

import { PrintMarks } from '@/src/features/templates/ui/PrintMarks';

const marks = () => screen.getByTestId('print-marks');

describe('PrintMarks', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['unsaved', 'Not saved'],
    ['draft', 'Draft'],
  ] as const)('marks %s answers with a watermark', (status, text) => {
    render(<PrintMarks status={status} />);
    expect(screen.getByTestId('print-watermark')).toHaveTextContent(text);
  });

  it('adds no watermark to submitted answers', () => {
    render(<PrintMarks status="submitted" />);
    expect(screen.queryByTestId('print-watermark')).not.toBeInTheDocument();
    expect(marks()).toHaveTextContent(/^Printed /);
  });

  it('has the time of the print on the page before the browser prints', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-05T17:00:00Z'));
    render(<PrintMarks status="draft" />);
    const loaded = marks().textContent;

    vi.setSystemTime(new Date('2026-03-09T17:00:00Z'));
    // Outside act, as the browser fires it: the page must change before dispatchEvent returns.
    const reactGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const actEnvironment = reactGlobal.IS_REACT_ACT_ENVIRONMENT;
    reactGlobal.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      globalThis.dispatchEvent(new Event('beforeprint'));
      expect(marks().textContent).not.toBe(loaded);
    } finally {
      reactGlobal.IS_REACT_ACT_ENVIRONMENT = actEnvironment;
    }
  });
});
