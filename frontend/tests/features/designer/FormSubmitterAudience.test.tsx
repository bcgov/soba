import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { SWRConfig } from 'swr';
import type { FormSubmitterAudience as FormAudience, SubmitterAudience } from '@/src/types/groups';
import { ApiError } from '@/src/shared/api/sobaHelpers';
import { SessionExpiredError } from '@/src/shared/api/sobaFetch';

const { mockGet, mockSet, mockFormGet, mockFormSet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockFormGet: vi.fn(),
  mockFormSet: vi.fn(),
}));

vi.mock('@/src/shared/api/sobaApiGroups', () => ({
  getSubmitterAudience: mockGet,
  setSubmitterAudience: mockSet,
  getFormSubmitterAudience: mockFormGet,
  setFormSubmitterAudience: mockFormSet,
}));

vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => ({
    general: {
      noAccess: 'You do not have access to this.',
      sessionExpired: 'Your session has ended.',
    },
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
      submitterAudienceInherit: 'Inherit from workspace',
      submitterAudienceInheritedSummary: 'Inherited: {summary}',
      submitterAudienceUsersNotApplied: 'People do not apply',
    },
  }),
}));

import makeStore from '@/lib/store';
import { setAuthenticated, setToken } from '@/lib/slices/keycloakSlice';
import { FormSubmitterAudience } from '@/src/features/designer/ui/FormSubmitterAudience';

let store: ReturnType<typeof makeStore>;

function renderAudience(
  props: { workspaceId?: string | null; formId?: string; canManage?: boolean } = {},
) {
  const { workspaceId = 'ws1', formId, canManage = true } = props;
  return render(
    <Provider store={store}>
      <SWRConfig
        value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}
      >
        <FormSubmitterAudience workspaceId={workspaceId} formId={formId} canManage={canManage} />
      </SWRConfig>
    </Provider>,
  );
}

const audience = (over: Partial<SubmitterAudience>): SubmitterAudience => ({
  mode: 'none',
  idps: [],
  users: [],
  available: [{ code: 'azureidir', name: 'IDIR - MFA' }],
  ...over,
});

describe('FormSubmitterAudience summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store = makeStore();
    store.dispatch(setToken('token'));
    store.dispatch(setAuthenticated(true));
  });

  it('shows the protected providers by name', async () => {
    mockGet.mockResolvedValue(audience({ mode: 'protected', idps: ['azureidir'] }));
    renderAudience();
    expect(await screen.findByTestId('submitter-audience-trigger')).toHaveTextContent(
      'Protected (IDIR - MFA)',
    );
  });

  it('shows Public / Not set for the other modes', async () => {
    mockGet.mockResolvedValueOnce(audience({ mode: 'public' }));
    const { unmount } = renderAudience();
    expect(await screen.findByTestId('submitter-audience-trigger')).toHaveTextContent('Public');
    unmount();

    mockGet.mockResolvedValueOnce(audience({ mode: 'none' }));
    renderAudience();
    expect(await screen.findByText('Not set')).toBeInTheDocument();
  });

  it('disables the control for non-managers', async () => {
    mockGet.mockResolvedValue(audience({ mode: 'public' }));
    renderAudience({ canManage: false });
    expect(await screen.findByTestId('submitter-audience-trigger')).toBeDisabled();
  });

  // Reading the audience needs a workspace permission the form's designer need not hold. A refusal
  // is not the same as a failed load.
  it('says no access when the read is refused', async () => {
    mockGet.mockRejectedValue(new ApiError('Forbidden', 403));
    renderAudience();
    expect(await screen.findByText('You do not have access to this.')).toBeInTheDocument();
    expect(screen.queryByText('load error')).not.toBeInTheDocument();
  });

  // An ended session is not a permission verdict, and telling someone they lack access sends them
  // to an administrator when all they need is to sign in again.
  it('reports an ended session as one', async () => {
    mockGet.mockRejectedValue(new SessionExpiredError());
    renderAudience();
    expect(await screen.findByText('Your session has ended.')).toBeInTheDocument();
    expect(screen.queryByText('load error')).not.toBeInTheDocument();
    expect(screen.queryByText('You do not have access to this.')).not.toBeInTheDocument();
  });

  it('still reports a genuine failure as a load error', async () => {
    mockGet.mockRejectedValue(new ApiError('Boom', 500));
    renderAudience();
    expect(await screen.findByText('load error')).toBeInTheDocument();
  });
});

const formAudience = (over: Partial<FormAudience>): FormAudience => ({
  inherit: true,
  mode: 'protected',
  idps: ['azureidir'],
  available: [{ code: 'azureidir', name: 'IDIR - MFA' }],
  workspace: { mode: 'protected', idps: ['azureidir'], users: [] },
  ...over,
});

describe('FormSubmitterAudience for a form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store = makeStore();
    store.dispatch(setToken('token'));
    store.dispatch(setAuthenticated(true));
  });

  it('reads the form audience and says when it is inherited', async () => {
    mockFormGet.mockResolvedValue(formAudience({}));
    renderAudience({ formId: 'f1' });
    expect(await screen.findByTestId('submitter-audience-trigger')).toHaveTextContent(
      'Inherited: Protected (IDIR - MFA)',
    );
    expect(mockFormGet).toHaveBeenCalledWith('token', 'f1');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('shows an override without the inherited label', async () => {
    mockFormGet.mockResolvedValue(formAudience({ inherit: false, mode: 'public', idps: [] }));
    renderAudience({ formId: 'f1' });
    await waitFor(() =>
      expect(screen.getByTestId('submitter-audience-trigger')).toHaveTextContent(/^Public$/),
    );
  });

  it('saves a return to the workspace audience', async () => {
    const user = userEvent.setup();
    mockFormGet.mockResolvedValue(formAudience({ inherit: false, mode: 'public', idps: [] }));
    mockFormSet.mockResolvedValue(formAudience({}));
    renderAudience({ formId: 'f1' });
    const trigger = await screen.findByTestId('submitter-audience-trigger');
    await waitFor(() => expect(trigger).toBeEnabled());
    await user.click(trigger);
    await user.click(await screen.findByText('Inherit from workspace'));
    expect(screen.getByTestId('audience-workspace-summary')).toHaveTextContent(
      'Protected (IDIR - MFA)',
    );
    await user.click(screen.getByTestId('audience-save'));
    await waitFor(() =>
      expect(mockFormSet).toHaveBeenCalledWith('token', 'f1', { mode: 'inherit' }),
    );
    expect(mockSet).not.toHaveBeenCalled();
    // The saved audience is what the control shows once the panel closes.
    await waitFor(() => expect(screen.queryByTestId('audience-save')).not.toBeInTheDocument());
    expect(trigger).toHaveTextContent('Inherited: Protected (IDIR - MFA)');
  });

  // Workspace people are not a principal for an override, so protected needs a provider.
  it('holds a providerless override back, then saves the chosen providers', async () => {
    const user = userEvent.setup();
    const users = [{ membershipId: 'm1', displayLabel: 'Pat' }];
    mockFormGet.mockResolvedValue(
      formAudience({ idps: [], workspace: { mode: 'protected', idps: [], users } }),
    );
    mockFormSet.mockResolvedValue(formAudience({ inherit: false, idps: ['azureidir'] }));
    renderAudience({ formId: 'f1' });
    const trigger = await screen.findByTestId('submitter-audience-trigger');
    await waitFor(() => expect(trigger).toBeEnabled());
    await user.click(trigger);
    await user.click(await screen.findByText('Protected'));
    expect(screen.getByTestId('audience-save')).toBeDisabled();
    await user.click(screen.getByText('IDIR - MFA'));
    expect(screen.getByTestId('audience-save')).toBeEnabled();
    await user.click(screen.getByTestId('audience-save'));
    await waitFor(() =>
      expect(mockFormSet).toHaveBeenCalledWith('token', 'f1', {
        mode: 'protected',
        idps: ['azureidir'],
      }),
    );
  });

  // A saved provider that is no longer offered has no checkbox, so it could never be unticked and
  // every save would be refused.
  it('leaves saved providers that are no longer offered out of a save', async () => {
    const user = userEvent.setup();
    mockFormGet.mockResolvedValue(formAudience({ inherit: false, idps: ['azureidir', 'retired'] }));
    mockFormSet.mockResolvedValue(formAudience({ inherit: false }));
    renderAudience({ formId: 'f1' });
    const trigger = await screen.findByTestId('submitter-audience-trigger');
    await waitFor(() => expect(trigger).toBeEnabled());
    await user.click(trigger);
    await user.click(await screen.findByTestId('audience-save'));
    await waitFor(() =>
      expect(mockFormSet).toHaveBeenCalledWith('token', 'f1', {
        mode: 'protected',
        idps: ['azureidir'],
      }),
    );
  });

  // A form's cached copy of the workspace audience must not outlive a workspace save, including
  // when the form's control is not mounted at the time.
  it('drops the cached form audience when the workspace audience is saved', async () => {
    const user = userEvent.setup();
    const cache = new Map();
    const tree = (node: React.ReactNode) => (
      <Provider store={store}>
        <SWRConfig
          value={{ provider: () => cache, dedupingInterval: 0, shouldRetryOnError: false }}
        >
          {node}
        </SWRConfig>
      </Provider>
    );

    mockFormGet.mockResolvedValueOnce(formAudience({}));
    const formView = render(
      tree(<FormSubmitterAudience workspaceId="ws1" formId="f1" canManage />),
    );
    expect(await screen.findByText('Inherited: Protected (IDIR - MFA)')).toBeInTheDocument();
    formView.unmount();

    mockGet.mockResolvedValue(audience({ mode: 'protected', idps: ['azureidir'] }));
    mockSet.mockResolvedValue(audience({ mode: 'public' }));
    const workspaceView = render(tree(<FormSubmitterAudience workspaceId="ws1" canManage />));
    const trigger = await screen.findByTestId('submitter-audience-trigger');
    await waitFor(() => expect(trigger).toBeEnabled());
    await user.click(trigger);
    await user.click(await screen.findByText('Public'));
    await user.click(screen.getByTestId('audience-save'));
    await waitFor(() => expect(screen.queryByTestId('audience-save')).not.toBeInTheDocument());
    workspaceView.unmount();

    mockFormGet.mockImplementation(() => new Promise(() => {}));
    render(tree(<FormSubmitterAudience workspaceId="ws1" formId="f1" canManage />));
    expect(screen.queryByText('Inherited: Protected (IDIR - MFA)')).not.toBeInTheDocument();
    expect(screen.getByTestId('submitter-audience-trigger')).toBeDisabled();
  });

  // An override holds providers only, so choosing one drops the workspace's named people.
  it('warns that named people do not carry into an override', async () => {
    const user = userEvent.setup();
    const users = [
      { membershipId: 'm1', displayLabel: 'Pat' },
      { membershipId: 'm2', displayLabel: 'Sam' },
    ];
    mockFormGet.mockResolvedValue(
      formAudience({ workspace: { mode: 'protected', idps: ['azureidir'], users } }),
    );
    renderAudience({ formId: 'f1' });
    const trigger = await screen.findByTestId('submitter-audience-trigger');
    await waitFor(() => expect(trigger).toBeEnabled());
    expect(trigger).toHaveTextContent('Inherited: Protected (IDIR - MFA, 2 people)');
    await user.click(trigger);
    expect(screen.queryByTestId('audience-people-note')).not.toBeInTheDocument();
    await user.click(await screen.findByText('Public'));
    expect(screen.getByTestId('audience-people-note')).toBeInTheDocument();
  });
});
