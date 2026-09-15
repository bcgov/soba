import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormSubmitterAudience, SubmitterAudience } from '@/src/types/groups';

vi.mock('@/lib/hooks/useKeycloak', () => ({
  useKeycloak: () => ({ authenticated: true, token: 'token', initializing: false }),
}));

vi.mock('@/app/[lang]/Providers', () => ({
  useDictionary: () => ({
    form: {
      loading: 'Loading',
      apiKey: 'API Key',
      nameLabel: 'Form Name',
      descriptionLabel: 'Description',
      noActiveWorkspace: 'Select a workspace before creating a form.',
      noActiveWorkspaceError: 'Select a workspace before saving this form.',
      disclaimerRequired: 'Accept the workspace disclaimer before creating a form.',
      schemaNotAvailable: 'Form schema not available.',
      loadFormError: 'Failed to load form.',
      staleEdits: 'Your unsaved edits were made on an older version of this form.',
      discardEdits: 'Discard edits',
      submitterAudienceLabel: 'Who can submit',
      submitterAudiencePublic: 'Public',
      submitterAudienceProtected: 'Protected',
      submitterAudienceNotSet: 'Not set',
      submitterAudiencePeople: 'people',
      submitterAudienceInheritedSummary: 'Inherited: {summary}',
      submitterAudienceLoadError: 'load error',
    },
    general: { notAuthenticated: 'Not authed', lookupTruncated: 'Showing the first {limit}.' },
    workspaces: { workspace: 'Workspace' },
    locale: 'en',
    modal: {
      dialogActions: 'Dialog actions',
    },
  }),
}));

type Workspace = {
  id: string;
  name?: string;
  kind?: string;
  role?: string;
  disclaimerAccepted: boolean;
};
type Version = { id: string; versionNo: number; state: string };

const { mockWorkspaceState, api, builder, audienceApi } = vi.hoisted(() => ({
  audienceApi: {
    getSubmitterAudience: vi.fn(),
    getFormSubmitterAudience: vi.fn(),
  },
  mockWorkspaceState: {
    creatable: [{ id: 'ws1', disclaimerAccepted: true }] as Workspace[],
    formCreate: 'allowed' as string,
    versions: [] as Version[],
    // When set, the version options the lookup returns instead of every version.
    versionOptions: null as { items: Version[]; truncated: boolean } | null,
    schemas: {} as Record<string, unknown>,
  },
  // Captured so a test can simulate the user editing in the builder.
  builder: { onUpdateModel: null as ((model: unknown) => void) | null },
  api: {
    saveFormVersionSchema: vi.fn(),
    publishSobaFormVersion: vi.fn(),
    createFormVersion: vi.fn(),
    createSobaFormioForm: vi.fn(),
    updateSobaForm: vi.fn().mockResolvedValue({}),
    getFormVersionSchema: vi.fn(),
    getSobaForm: vi.fn(),
    lookupFormVersions: vi.fn(),
    lookupWorkspaces: vi.fn(),
    selectWorkspace: vi.fn((_token: string, id: string) =>
      Promise.resolve({ id, name: 'Alpha', kind: 'team', role: 'owner', disclaimerAccepted: true }),
    ),
  },
}));

vi.mock('@/src/shared/api/sobaApi', () => ({
  getSobaForm: api.getSobaForm,
  lookupFormVersions: api.lookupFormVersions,
  getSobaFormVersion: vi.fn((_token: string, id: string) =>
    Promise.resolve(mockWorkspaceState.versions.find((v) => v.id === id)),
  ),
  getFormVersionSchema: api.getFormVersionSchema,
  saveFormVersionSchema: api.saveFormVersionSchema,
  publishSobaFormVersion: api.publishSobaFormVersion,
  createFormVersion: api.createFormVersion,
  createSobaFormioForm: api.createSobaFormioForm,
  updateSobaForm: api.updateSobaForm,
  lookupWorkspaces: api.lookupWorkspaces,
  selectWorkspace: api.selectWorkspace,
  fetchCurrentUser: vi.fn(() =>
    Promise.resolve({
      capabilities: {
        canCreateWorkspace: false,
        hasWorkspaces: true,
        formCreate: mockWorkspaceState.formCreate,
        isSobaAdmin: false,
      },
    }),
  ),
}));

// The submitter audience control reads through its own API module: the workspace's on the create
// page, the form's on an existing form.
vi.mock('@/src/shared/api/sobaApiGroups', () => ({
  getSubmitterAudience: audienceApi.getSubmitterAudience,
  setSubmitterAudience: vi.fn(),
  getFormSubmitterAudience: audienceApi.getFormSubmitterAudience,
  setFormSubmitterAudience: vi.fn(),
}));

const providers = [{ code: 'azureidir', name: 'IDIR - MFA' }];
const workspaceAudience: SubmitterAudience = {
  mode: 'protected',
  idps: ['azureidir'],
  users: [],
  available: providers,
};
const formAudience: FormSubmitterAudience = {
  inherit: true,
  mode: 'protected',
  idps: ['azureidir'],
  available: providers,
  workspace: { mode: 'protected', idps: ['azureidir'], users: [] },
};

// Mock DynamicForm and FormDesigner components used in FormForm
vi.mock('@/src/features/formio-v5/ui/DynamicForm', () => ({
  DynamicForm: () => <div data-testid="dynamic-form">preview</div>,
}));
// The real FormDesigner takes its model once at mount and ignores later changes. The stub does the
// same, so a version switch that fails to remount it is visible here.
vi.mock('@/src/features/designer/ui/FormDesigner', () => {
  function FormDesignerStub({
    initialModel,
    onUpdateModel,
  }: {
    initialModel: unknown;
    onUpdateModel: (model: unknown) => void;
  }) {
    const [snapshot] = React.useState(() => JSON.stringify(initialModel));
    builder.onUpdateModel = onUpdateModel;
    return <div data-testid="form-designer">{snapshot}</div>;
  }
  return { __esModule: true, default: FormDesignerStub };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {} }),
  useParams: () => ({ lang: 'en' }),
  useSearchParams: () => new URLSearchParams(''),
}));

import { Provider } from 'react-redux';
import { SWRConfig } from 'swr';
import makeStore from '@/lib/store';
import { setAuthenticated, setToken } from '@/lib/slices/keycloakSlice';
import FormForm from '@/src/features/designer/ui/FormForm';
import { PageLayout } from '@/src/components/PageLayout';
import { ApiError } from '@/src/shared/api/sobaHelpers';

let store: ReturnType<typeof makeStore>;

const newestFirst = (versions: Version[]) =>
  [...versions].sort((a, b) => b.versionNo - a.versionNo);

async function renderForm(props: { formId?: string } = {}) {
  const view: ReturnType<typeof render> | undefined = render(
    <Provider store={store}>
      <SWRConfig
        value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}
      >
        <PageLayout headingId="designer-heading" heading="Form Designer">
          <FormForm {...props} />
        </PageLayout>
      </SWRConfig>
    </Provider>,
  );
  return view!;
}

describe('FormForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store = makeStore();
    store.dispatch(setToken('token'));
    store.dispatch(setAuthenticated(true));
    mockWorkspaceState.creatable = [{ id: 'ws1', disclaimerAccepted: true }];
    mockWorkspaceState.formCreate = 'allowed';
    mockWorkspaceState.versions = [];
    mockWorkspaceState.versionOptions = null;
    mockWorkspaceState.schemas = {};
    api.getFormVersionSchema.mockImplementation((_token: string, versionId: string) =>
      Promise.resolve(mockWorkspaceState.schemas[versionId] ?? { components: [] }),
    );
    // The server's current version is the highest-numbered one.
    api.getSobaForm.mockImplementation(() =>
      Promise.resolve({
        id: 'f1',
        name: 'Test',
        description: '',
        permissions: ['*'],
        currentVersion: newestFirst(mockWorkspaceState.versions)[0] ?? null,
      }),
    );
    api.lookupFormVersions.mockImplementation(() =>
      Promise.resolve({
        limit: 500,
        ...(mockWorkspaceState.versionOptions ?? {
          items: newestFirst(mockWorkspaceState.versions),
          truncated: false,
        }),
      }),
    );
    api.lookupWorkspaces.mockImplementation(() =>
      Promise.resolve({ items: mockWorkspaceState.creatable, limit: 500, truncated: false }),
    );
    api.createFormVersion.mockResolvedValue({ id: 'v-new', versionNo: 3, state: 'draft' });
    api.saveFormVersionSchema.mockResolvedValue({});
    api.publishSobaFormVersion.mockResolvedValue({});
    audienceApi.getSubmitterAudience.mockImplementation(() => new Promise(() => {}));
    audienceApi.getFormSubmitterAudience.mockImplementation(() => new Promise(() => {}));
    builder.onUpdateModel = null;
  });

  it('renders designer tab content when authenticated and not initializing', async () => {
    await act(async () => {
      await renderForm({ formId: 'f1' });
    });
    // The designer area includes a form name input; assert it renders with loaded value
    await waitFor(() => expect(screen.getByDisplayValue('Test')).toBeInTheDocument());
  });

  it('blocks new-form designer access when the user cannot create a form anywhere', async () => {
    mockWorkspaceState.formCreate = 'none';
    mockWorkspaceState.creatable = [];
    await act(async () => {
      await renderForm();
    });
    expect(await screen.findByTestId('designer-select-workspace')).toBeInTheDocument();
    expect(screen.queryByTestId('form-designer')).not.toBeInTheDocument();
  });

  // A picker that disappears reads as a missing feature, so it shows even for a single choice,
  // and the workspace a form lands in is always an explicit choice, never preselected.
  it('shows the workspace picker unselected even with one creatable workspace', async () => {
    mockWorkspaceState.creatable = [
      { id: 'ws1', name: 'Alpha', kind: 'team', disclaimerAccepted: true },
    ];
    await act(async () => {
      await renderForm();
    });

    const picker = await screen.findByTestId('workspace-select');
    expect(picker.querySelector('select')).toHaveValue('');
    expect(screen.getAllByText('Alpha (team)').length).toBeGreaterThan(0);
  });

  // The forms-list filter scopes what you are viewing, not where a new form belongs.
  it('does not preselect the workspace chosen in the forms-list filter', async () => {
    mockWorkspaceState.creatable = [
      { id: 'ws1', name: 'Alpha', kind: 'team', disclaimerAccepted: true },
      { id: 'ws2', name: 'Beta', kind: 'team', disclaimerAccepted: true },
    ];
    await act(async () => {
      await renderForm();
    });

    const picker = await screen.findByTestId('workspace-select');
    expect(picker.querySelector('select')).toHaveValue('');
  });

  // Create permission without an accepted disclaimer is actionable, so it gets its own message.
  it('blocks new-form designer access when no workspace has an accepted disclaimer', async () => {
    mockWorkspaceState.formCreate = 'disclaimer_required';
    mockWorkspaceState.creatable = [];
    await act(async () => {
      await renderForm();
    });
    expect(await screen.findByTestId('disclaimer-required-alert')).toBeInTheDocument();
    expect(screen.queryByTestId('form-designer')).not.toBeInTheDocument();
  });

  it('does not read the new-form workspace options for an existing form', async () => {
    await act(async () => {
      await renderForm({ formId: 'f1' });
    });
    await waitFor(() => expect(screen.getByDisplayValue('Test')).toBeInTheDocument());
    expect(api.lookupWorkspaces).not.toHaveBeenCalled();
  });

  // A picked workspace is one of the create options, which already carry the role.
  it('does not read a workspace picked from the create options', async () => {
    mockWorkspaceState.creatable = [
      { id: 'ws1', name: 'Alpha', kind: 'team', role: 'owner', disclaimerAccepted: true },
    ];
    await act(async () => {
      await renderForm();
    });

    const picker = (await screen.findByTestId('workspace-select')).querySelector(
      'select',
    ) as HTMLSelectElement;
    fireEvent.change(picker, { target: { value: 'ws1' } });

    await waitFor(() => expect(picker).toHaveValue('ws1'));
    expect(api.selectWorkspace).not.toHaveBeenCalled();
  });

  // A new form inherits its workspace's audience, so the create page only shows it, even to an owner.
  it('shows the workspace audience read-only on the create page', async () => {
    mockWorkspaceState.creatable = [
      { id: 'ws1', name: 'Alpha', kind: 'team', role: 'owner', disclaimerAccepted: true },
    ];
    audienceApi.getSubmitterAudience.mockResolvedValue(workspaceAudience);
    await act(async () => {
      await renderForm();
    });

    const picker = (await screen.findByTestId('workspace-select')).querySelector(
      'select',
    ) as HTMLSelectElement;
    fireEvent.change(picker, { target: { value: 'ws1' } });

    const trigger = await screen.findByTestId('submitter-audience-trigger');
    await waitFor(() => expect(trigger).toHaveTextContent('Protected (IDIR - MFA)'));
    expect(trigger).toBeDisabled();
    expect(audienceApi.getFormSubmitterAudience).not.toHaveBeenCalled();
  });

  // Changing a form's audience is a form_update; reading the form is not enough.
  it.each([
    ['form_read', ['form_read'], true],
    ['form_update', ['form_read', 'form_update'], false],
    ['the wildcard', ['*'], false],
  ])('gates the form audience for %s', async (_label, permissions, disabled) => {
    api.getSobaForm.mockImplementation(() =>
      Promise.resolve({
        id: 'f1',
        name: 'Test',
        description: '',
        permissions,
        currentVersion: null,
      }),
    );
    audienceApi.getFormSubmitterAudience.mockResolvedValue(formAudience);
    await act(async () => {
      await renderForm({ formId: 'f1' });
    });

    await waitFor(() => expect(screen.getByDisplayValue('Test')).toBeInTheDocument());
    const trigger = await screen.findByTestId('submitter-audience-trigger');
    await waitFor(() => expect(trigger).toHaveTextContent('Inherited: Protected (IDIR - MFA)'));
    expect(trigger).toHaveProperty('disabled', disabled);
    expect(audienceApi.getFormSubmitterAudience).toHaveBeenCalledWith('token', 'f1');
    expect(audienceApi.getSubmitterAudience).not.toHaveBeenCalled();
  });

  // The form's current version is what the builder is fed.
  it('reads the schema of the current version', async () => {
    mockWorkspaceState.versions = [
      { id: 'v1', versionNo: 1, state: 'published' },
      { id: 'v2', versionNo: 2, state: 'draft' },
    ];
    await act(async () => {
      await renderForm({ formId: 'f1' });
    });

    const { getFormVersionSchema } = await import('@/src/shared/api/sobaApi');
    await waitFor(() => expect(getFormVersionSchema).toHaveBeenCalledWith('token', 'v2'));
    expect(getFormVersionSchema).not.toHaveBeenCalledWith('token', 'v1');
  });

  // The options stop at the lookup limit and their order is the endpoint's. Neither may decide
  // which version a save writes to.
  it('saves to the form current version when the options do not include it', async () => {
    mockWorkspaceState.versions = [
      { id: 'v1', versionNo: 1, state: 'published' },
      { id: 'v2', versionNo: 2, state: 'draft' },
    ];
    mockWorkspaceState.versionOptions = {
      items: [{ id: 'v1', versionNo: 1, state: 'published' }],
      truncated: true,
    };
    await act(async () => {
      await renderForm({ formId: 'f1' });
    });
    await waitFor(() => expect(screen.getByTestId('form-designer')).toBeInTheDocument());
    expect(screen.getAllByText('Showing the first 500.').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByTestId('save-form-button'));
    await waitFor(() => expect(api.saveFormVersionSchema).toHaveBeenCalled());
    expect(api.saveFormVersionSchema.mock.calls[0][1]).toBe('v2');
  });

  // Someone else created v2 while v1 was open. The refused edits are kept, but they were made on v1
  // and must not be saved onto v2: they can go to a new version or be discarded.
  it('blocks saving stale edits onto the newer version after a save is refused', async () => {
    mockWorkspaceState.versions = [{ id: 'v1', versionNo: 1, state: 'draft' }];
    mockWorkspaceState.schemas = { v1: { components: [{ key: 'original' }] } };
    await act(async () => {
      await renderForm({ formId: 'f1' });
    });
    await waitFor(() => expect(screen.getByTestId('form-designer')).toHaveTextContent('original'));

    await act(async () => {
      builder.onUpdateModel?.({ components: [{ key: 'edited' }] } as never);
    });
    api.saveFormVersionSchema.mockImplementationOnce(() => {
      mockWorkspaceState.versions = [
        ...mockWorkspaceState.versions,
        { id: 'v2', versionNo: 2, state: 'draft' },
      ];
      return Promise.reject(new ApiError('Conflict', 409));
    });

    await userEvent.click(screen.getByTestId('save-form-button'));

    expect(await screen.findByTestId('page-notice-stale-edits')).toBeInTheDocument();
    expect(screen.getAllByText('Current Draft (v2)').length).toBeGreaterThan(0);
    expect(screen.getByTestId('save-form-button')).toBeDisabled();
    expect(screen.getByTestId('publish-form-button')).toBeDisabled();
    expect(screen.getByTestId('new-version-button')).toBeEnabled();

    await userEvent.click(screen.getByTestId('page-notice-stale-edits-action'));
    await waitFor(() =>
      expect(screen.queryByTestId('page-notice-stale-edits')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('save-form-button')).toBeEnabled();
    expect(api.saveFormVersionSchema).toHaveBeenCalledTimes(1);
  });

  // Publishing changes the state that gates Save, and that state comes from the form.
  it('publishes the current version and reads the form again', async () => {
    mockWorkspaceState.versions = [{ id: 'v1', versionNo: 1, state: 'draft' }];
    await act(async () => {
      await renderForm({ formId: 'f1' });
    });
    await waitFor(() => expect(screen.getByTestId('publish-form-button')).toBeEnabled());
    const formReads = api.getSobaForm.mock.calls.length;

    await userEvent.click(screen.getByTestId('publish-form-button'));
    await waitFor(() => expect(api.publishSobaFormVersion).toHaveBeenCalledWith('token', 'v1'));
    await waitFor(() => expect(api.getSobaForm.mock.calls.length).toBeGreaterThan(formReads));
  });

  // The loaded name is server truth and the typed one is the user's unsaved edit. A re-read must
  // never win over what has been typed.
  it('keeps a typed name over the loaded one', async () => {
    await act(async () => {
      await renderForm({ formId: 'f1' });
    });
    const input = (await screen.findByDisplayValue('Test')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Renamed' } });
    expect(await screen.findByDisplayValue('Renamed')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Test')).not.toBeInTheDocument();
  });

  // Switching versions changes which schema is read, and the read-only notice explains why save is
  // off. Selecting the current draft again returns to it.
  it('reads the selected version schema when switching to history', async () => {
    mockWorkspaceState.versions = [
      { id: 'v1', versionNo: 1, state: 'published' },
      { id: 'v2', versionNo: 2, state: 'draft' },
    ];
    await act(async () => {
      await renderForm({ formId: 'f1' });
    });

    const { getFormVersionSchema } = await import('@/src/shared/api/sobaApi');
    await waitFor(() => expect(getFormVersionSchema).toHaveBeenCalledWith('token', 'v2'));

    const picker = (await screen.findByTestId('form-version-select')).querySelector(
      'select',
    ) as HTMLSelectElement;
    fireEvent.change(picker, { target: { value: 'v1' } });

    await waitFor(() => expect(getFormVersionSchema).toHaveBeenCalledWith('token', 'v1'));
    expect(await screen.findByTestId('page-notice-history-view')).toBeInTheDocument();
  });

  // The builder is fed its model once at mount. Returning to a version already in the cache
  // produces no loading frame, so the previous version stays on screen unless it is remounted.
  it('shows the right schema when switching back to a cached version', async () => {
    mockWorkspaceState.versions = [
      { id: 'v1', versionNo: 1, state: 'published' },
      { id: 'v2', versionNo: 2, state: 'draft' },
    ];
    mockWorkspaceState.schemas = {
      v1: { components: [{ key: 'from-v1' }] },
      v2: { components: [{ key: 'from-v2' }] },
    };
    await act(async () => {
      await renderForm({ formId: 'f1' });
    });

    const picker = (await screen.findByTestId('form-version-select')).querySelector(
      'select',
    ) as HTMLSelectElement;
    await waitFor(() => expect(screen.getByTestId('form-designer')).toHaveTextContent('from-v2'));

    fireEvent.change(picker, { target: { value: 'v1' } });
    await waitFor(() => expect(screen.getByTestId('form-designer')).toHaveTextContent('from-v1'));

    fireEvent.change(picker, { target: { value: 'current' } });
    await waitFor(() => expect(screen.getByTestId('form-designer')).toHaveTextContent('from-v2'));
  });

  // Saving drops the edit overlay. Without writing the saved body into the cache, the next write
  // posts the schema as it was before the edits.
  it('posts the saved schema, not the pre-save one, on a second save', async () => {
    mockWorkspaceState.versions = [{ id: 'v1', versionNo: 1, state: 'draft' }];
    mockWorkspaceState.schemas = { v1: { components: [{ key: 'original' }] } };
    await act(async () => {
      await renderForm({ formId: 'f1' });
    });
    await waitFor(() => expect(screen.getByTestId('form-designer')).toHaveTextContent('original'));

    await act(async () => {
      builder.onUpdateModel?.({ components: [{ key: 'edited' }] } as never);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.saveFormVersionSchema).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.saveFormVersionSchema).toHaveBeenCalledTimes(2));
    expect(api.saveFormVersionSchema.mock.calls[1][2]).toEqual({
      components: [{ key: 'edited' }],
    });
  });

  it('creates a new version from the saved schema', async () => {
    mockWorkspaceState.versions = [{ id: 'v1', versionNo: 1, state: 'draft' }];
    mockWorkspaceState.schemas = { v1: { components: [{ key: 'original' }] } };
    await act(async () => {
      await renderForm({ formId: 'f1' });
    });
    await waitFor(() => expect(screen.getByTestId('form-designer')).toHaveTextContent('original'));

    await act(async () => {
      builder.onUpdateModel?.({ components: [{ key: 'edited' }] } as never);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.saveFormVersionSchema).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole('button', { name: 'New Version' }));
    await waitFor(() => expect(api.createFormVersion).toHaveBeenCalled());
    const newVersionCall = api.saveFormVersionSchema.mock.calls.find((c) => c[1] === 'v-new');
    expect(newVersionCall?.[2]).toEqual({ components: [{ key: 'edited' }] });
  });

  // Once the form is read again the new version is current, so the next save goes to it and not to
  // the version it was created from.
  it('saves to the new version after creating it', async () => {
    mockWorkspaceState.versions = [{ id: 'v1', versionNo: 1, state: 'draft' }];
    mockWorkspaceState.schemas = { v1: { components: [{ key: 'original' }] } };
    api.createFormVersion.mockImplementation(() => {
      const created = { id: 'v-new', versionNo: 2, state: 'draft' };
      mockWorkspaceState.versions = [...mockWorkspaceState.versions, created];
      return Promise.resolve(created);
    });
    await act(async () => {
      await renderForm({ formId: 'f1' });
    });
    await waitFor(() => expect(screen.getByTestId('form-designer')).toHaveTextContent('original'));

    await userEvent.click(screen.getByRole('button', { name: 'New Version' }));
    await waitFor(() =>
      expect(screen.getAllByText('Current Draft (v2)').length).toBeGreaterThan(0),
    );
    // The create copies the schema into the new version: that is the first write.
    expect(api.saveFormVersionSchema).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByTestId('save-form-button'));
    await waitFor(() => expect(api.saveFormVersionSchema).toHaveBeenCalledTimes(2));
    expect(api.saveFormVersionSchema.mock.calls[1][1]).toBe('v-new');
  });

  // An existing form with no current version has nothing to save to. Falling through to the create
  // branch there files the edits under a second form.
  it('never creates a second form for an existing formId', async () => {
    mockWorkspaceState.versions = [];
    await act(async () => {
      await renderForm({ formId: 'f1' });
    });
    await waitFor(() => expect(screen.getByTestId('save-form-button')).toBeEnabled());

    await userEvent.click(screen.getByTestId('save-form-button'));
    expect(api.createSobaFormioForm).not.toHaveBeenCalled();
  });

  // The schema key is null until the form arrives, so a loading flag covering only the schema read
  // reports ready and the designer claims the schema is missing.
  it('shows a spinner, not "schema not available", while the draft assembles', async () => {
    mockWorkspaceState.versions = [{ id: 'v1', versionNo: 1, state: 'draft' }];
    await act(async () => {
      await renderForm({ formId: 'f1' });
    });

    expect(screen.queryByText('Form schema not available.')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('form-designer')).toBeInTheDocument());
  });

  // These reads do not revalidate on their own, so a failed load that still reports loading leaves
  // the designer on a spinner with every tab and action disabled, for the life of the page.
  it('reports a failed load instead of spinning', async () => {
    api.getSobaForm.mockRejectedValue(new Error('boom'));
    await act(async () => {
      await renderForm({ formId: 'f1' });
    });

    expect(await screen.findByTestId('designer-load-error')).toHaveTextContent(
      'Failed to load form.',
    );
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
  });
});
