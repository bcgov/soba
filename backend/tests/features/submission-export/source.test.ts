import { ValidationError } from '../../../src/core/errors';
import { exportBounds } from '../../../src/features/submission-export/source';

describe('exportBounds', () => {
  const now = new Date('2026-10-29T20:00:00Z');

  it('ends at now when no end is given or the end is later', () => {
    expect(exportBounds({}, now)).toEqual({ to: now.toISOString() });
    expect(exportBounds({ to: '2026-12-01T00:00:00Z' }, now)).toEqual({
      to: now.toISOString(),
    });
  });

  it('keeps an earlier end and the start as given', () => {
    expect(exportBounds({ from: '2026-10-01T07:00:00Z', to: '2026-10-02T07:00:00Z' }, now)).toEqual(
      { from: '2026-10-01T07:00:00.000Z', to: '2026-10-02T07:00:00.000Z' },
    );
  });

  it('refuses a start at or after now', () => {
    expect(() => exportBounds({ from: '2026-10-30T00:00:00Z' }, now)).toThrow(ValidationError);
  });
});
