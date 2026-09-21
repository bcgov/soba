import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
      settings: {
        formSettingsDrawerLabel: 'Form Settings',
        formKindList: { team: 'Team', public: 'Public' },
      },
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
    ministries: { min1: 'Ministry 1' },
    locale: 'en',
    modal: {
      dialogActions: 'Dialog actions',
    },
    useCases: {
      application: 'Applications that will be evaluated followed by a decision',
      collection: 'Collection of Datasets, data submission',
      feedback:
        'Feedback Form to determine satisfaction, agreement, likelihood, or other qualitative questions',
      report: 'Reporting usually on a repeating schedule or event driven like follow-ups',
      registration: 'Registrations or Sign up - no evaluation',
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

const { mockWorkspaceState, api, builder } = vi.hoisted(() => ({
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

// Mock DynamicForm and FormDesigner components used in FormForm
vi.mock('@/src/features/formio-v5/ui/DynamicForm', () => ({
  DynamicForm: () => <div data-testid="dynamic-form">preview</div>,
}));

vi.mock('@bcgov/design-system-react-components', async (importOriginal) => {
  type DesignSystem = typeof import('@bcgov/design-system-react-components') & {
    Tab: React.ElementType;
    Tabs: React.ElementType;
  };
  const mod = await importOriginal<DesignSystem & { default?: DesignSystem }>();
  const actual = mod.default || mod;
  return {
    __esModule: true,
    ...actual,
    TextField: actual.TextField,
    Button: actual.Button,
    InlineAlert: actual.InlineAlert,
    Tab: actual.Tab,
    Tabs: actual.Tabs,
    Select: ({
      selectedKey,
      onSelectionChange,
      items,
      'aria-label': ariaLabel,
      description,
      'data-testid': testId,
    }: {
      selectedKey: string;
      onSelectionChange: (newVal: unknown) => void;
      items: { id: string; label: string }[];
      'aria-label': string;
      'data-testid': string;
      description: string;
    }) => {
      return (
        <div data-testid={testId}>
          <select
            value={selectedKey || ''}
            onChange={(e) => onSelectionChange?.(e.target.value)}
            aria-label={ariaLabel}
          >
            <option value="">Select...</option>
            {items?.map((item: { id: string; label: string }) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          {description && <div>{description}</div>}
        </div>
      );
    },
  };
});

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

async function renderForm(props: { formId: string }) {
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
    builder.onUpdateModel = null;
  });

  it('renders designer tab content when authenticated and not initializing', async () => {
    await act(async () => {
      await renderForm({ formId: 'f1' });
    });
    // The designer area includes a form name heading; assert it renders with loaded value
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Test' })).toBeInTheDocument());
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
    const picker = screen
      .getByTestId('form-version-select')
      .querySelector('select') as HTMLSelectElement;
    expect(picker).not.toBeDisabled();

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
    await userEvent.selectOptions(picker, 'v1');

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

    await userEvent.selectOptions(picker, 'v1');
    await waitFor(() => expect(screen.getByTestId('form-designer')).toHaveTextContent('from-v1'));

    const picker2 = screen
      .getByTestId('form-version-select')
      .querySelector('select') as HTMLSelectElement;
    fireEvent.change(picker2, { target: { value: 'current' } });
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

    const picker = screen
      .getByTestId('form-version-select')
      .querySelector('select') as HTMLSelectElement;
    await userEvent.selectOptions(picker, 'create');
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

    const picker = screen
      .getByTestId('form-version-select')
      .querySelector('select') as HTMLSelectElement;
    await userEvent.selectOptions(picker, 'create');
    await waitFor(() =>
      expect(screen.getAllByText('Current Draft (v2)').length).toBeGreaterThan(0),
    );
    // The create copies the schema into the new version: that is the first write.
    expect(api.saveFormVersionSchema).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByTestId('save-form-button'));
    await waitFor(() => expect(api.saveFormVersionSchema).toHaveBeenCalledTimes(2));
    expect(api.saveFormVersionSchema.mock.calls[1][1]).toBe('v-new');
  });

  // A form with no current version has nothing to save to. Writing anyway would file the schema
  // against a version the form does not carry.
  it('writes nothing for a form with no current version', async () => {
    mockWorkspaceState.versions = [];
    await act(async () => {
      await renderForm({ formId: 'f1' });
    });
    await waitFor(() => expect(screen.getByTestId('save-form-button')).toBeEnabled());

    await userEvent.click(screen.getByTestId('save-form-button'));
    expect(api.saveFormVersionSchema).not.toHaveBeenCalled();
  });

  // The schema key is null until the form arrives, so a loading flag covering only the schema read
  // reports ready before there is anything to draw.
  it('waits for the draft to assemble before drawing the designer', async () => {
    mockWorkspaceState.versions = [{ id: 'v1', versionNo: 1, state: 'draft' }];
    await act(async () => {
      await renderForm({ formId: 'f1' });
    });

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
