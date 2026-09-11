import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SubmitterAudience } from '@/src/types/groups';

const { mockGet, mockSet } = vi.hoisted(() => ({ mockGet: vi.fn(), mockSet: vi.fn() }));

vi.mock('@/src/shared/api/sobaApiGroups', () => ({
  getSubmitterAudience: mockGet,
  setSubmitterAudience: mockSet,
}));

vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => ({
    form: {
      submitterAudienceLabel: 'Who can submit',
      submitterAudiencePublic: 'Public',
      submitterAudienceProtected: 'Protected',
      submitterAudienceProviders: 'Allowed logins',
      submitterAudienceNotSet: 'Not set',
      submitterAudiencePeople: 'people',
      submitterAudienceSave: 'Save',
      submitterAudienceCancel: 'Cancel',
      submitterAudienceLoadError: 'load error',
      submitterAudienceSaveError: 'save error',
    },
  }),
}));

import { FormSubmitterAudience } from '@/src/features/designer/ui/FormSubmitterAudience';

const audience = (over: Partial<SubmitterAudience>): SubmitterAudience => ({
  mode: 'none',
  idps: [],
  users: [],
  available: [{ code: 'azureidir', name: 'IDIR - MFA' }],
  ...over,
});

describe('FormSubmitterAudience summary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the protected providers by name', async () => {
    mockGet.mockResolvedValue(audience({ mode: 'protected', idps: ['azureidir'] }));
    render(<FormSubmitterAudience workspaceId="ws1" token="t" canManage />);
    expect(await screen.findByTestId('submitter-audience-trigger')).toHaveTextContent(
      'Protected (IDIR - MFA)',
    );
  });

  it('shows Public / Not set for the other modes', async () => {
    mockGet.mockResolvedValueOnce(audience({ mode: 'public' }));
    const { unmount } = render(<FormSubmitterAudience workspaceId="ws1" token="t" canManage />);
    expect(await screen.findByTestId('submitter-audience-trigger')).toHaveTextContent('Public');
    unmount();

    mockGet.mockResolvedValueOnce(audience({ mode: 'none' }));
    render(<FormSubmitterAudience workspaceId="ws1" token="t" canManage />);
    expect(await screen.findByText('Not set')).toBeInTheDocument();
  });

  it('disables the control for non-managers', async () => {
    mockGet.mockResolvedValue(audience({ mode: 'public' }));
    render(<FormSubmitterAudience workspaceId="ws1" token="t" canManage={false} />);
    expect(await screen.findByTestId('submitter-audience-trigger')).toBeDisabled();
  });
});
