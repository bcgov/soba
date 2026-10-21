import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/dictionaries/en.json';
import type { Dictionary } from '@/src/types/dictionary';

let allowed: boolean | null;
vi.mock('@/src/features/user-search/data/useUserSearch', () => ({
  useUserSearchAllowed: () => allowed,
}));
vi.mock('@/src/features/user-search/ui/UserSearchPicker', () => ({
  UserSearchPicker: ({ scope }: { scope: { kind: string; id: string } }) => (
    <div data-testid="picker">{`${scope.kind}:${scope.id}`}</div>
  ),
}));

import FormTeamTab from '@/src/features/designer/ui/FormTeamTab';

const dict = en as Dictionary;

describe('FormTeamTab', () => {
  beforeEach(() => {
    allowed = null;
  });

  it('searches the form when user search is allowed', () => {
    allowed = true;
    render(<FormTeamTab dict={dict} formId="form-1" />);
    expect(screen.getByTestId('picker')).toHaveTextContent('form:form-1');
  });

  it('says the team is coming soon when user search is not allowed', () => {
    allowed = false;
    render(<FormTeamTab dict={dict} formId="form-1" />);
    expect(screen.getByTestId('team-coming-soon')).toHaveTextContent(en.general.comingSoon);
    expect(screen.queryByTestId('picker')).not.toBeInTheDocument();
  });

  it('shows neither while the feature list loads', () => {
    render(<FormTeamTab dict={dict} formId="form-1" />);
    expect(screen.queryByTestId('picker')).not.toBeInTheDocument();
    expect(screen.queryByTestId('team-coming-soon')).not.toBeInTheDocument();
  });
});
