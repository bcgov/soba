import React, { act } from 'react';
import { vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';

import makeStore from '@/lib/store';
import { useFormTeamWriter } from '@/src/features/designer/data/useFormTeam';
import { resetFormTeam, useFormTeamWriter as sampleWriter } from './sampleFormTeam';
import type { TeamCandidate } from '@/src/types/formTeam';

/** Access tab test helpers. Tests use the sample data module and spy on the writer so a write can fail. */
export const renderWithStore = (ui: React.ReactElement) =>
  render(<Provider store={makeStore()}>{ui}</Provider>);

/** Clicks, then waits for the updates and promises the click set off. */
export const click = (element: HTMLElement) =>
  act(() => {
    fireEvent.click(element);
    return Promise.resolve();
  });

export const clickTestId = (testId: string) => click(screen.getByTestId(testId));

/** Puts the sample team and its fixture writer back. Call before each test. */
export const resetTeam = () => {
  vi.mocked(useFormTeamWriter).mockReset().mockImplementation(sampleWriter);
  act(() => resetFormTeam());
};

/** An existing active workspace member. */
export const workspacePerson = (id: string, name: string, userId = id): TeamCandidate => ({
  id: userId,
  membershipId: `membership-${id}`,
  name,
  email: `${id}@example.gov.bc.ca`,
});

/** The sample writer cannot fail, so a failed save is forced. */
export const failWrites = () => {
  const refuse = () => Promise.reject(new Error('refused'));
  vi.mocked(useFormTeamWriter).mockReturnValue({ add: refuse, setGroups: refuse, remove: refuse });
};
