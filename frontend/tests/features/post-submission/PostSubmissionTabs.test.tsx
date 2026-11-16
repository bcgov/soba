import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { SWRConfig } from 'swr';
import en from '@/dictionaries/en.json';
import type { Dictionary } from '@/src/types/dictionary';
import { ApiError } from '@/src/shared/api/sobaHelpers';

const { mockGetFormSettings, mockGetWorkspaceSettings } = vi.hoisted(() => ({
  mockGetFormSettings: vi.fn(),
  mockGetWorkspaceSettings: vi.fn(),
}));

vi.mock('@/src/features/form-settings/data/api', () => ({
  getFormSettings: mockGetFormSettings,
  getWorkspaceSettings: mockGetWorkspaceSettings,
  setFormSettings: vi.fn(),
  setWorkspaceSettings: vi.fn(),
}));

vi.mock('@/lib/hooks/useNotificationStore', () => ({
  useNotificationStore: () => ({ addNotification: vi.fn() }),
}));

// The loading spinner reads the dictionary from the page's providers.
vi.mock('@/app/[lang]/Providers', async () => {
  const dictionary = (await import('@/dictionaries/en.json')).default;
  return { useDictionary: () => dictionary };
});

import makeStore from '@/lib/store';
import { setAuthenticated, setToken } from '@/lib/slices/keycloakSlice';
import FormPostSubmissionTab from '@/src/features/post-submission/ui/FormPostSubmissionTab';
import WorkspacePostSubmissionTab from '@/src/features/post-submission/ui/WorkspacePostSubmissionTab';

const dict: Dictionary = en;
const OFF = { enabled: false, options: {} };
const formView = { inherit: true, own: null, workspace: OFF, effective: OFF, version: 0 };

const NO_CARD = {
  settings: { allowSubmitterEmailCopy: false, showConfirmationId: false },
  notifications: true,
};
const CARD = {
  settings: { allowSubmitterEmailCopy: true, showConfirmationId: true },
  notifications: true,
};
type FormTabProps = Partial<React.ComponentProps<typeof FormPostSubmissionTab>>;
type WorkspaceTabProps = Partial<React.ComponentProps<typeof WorkspacePostSubmissionTab>>;
const formTab = (props: FormTabProps = {}) => (
  <FormPostSubmissionTab
    dict={dict}
    formId="f1"
    actionsAvailable
    confirmation={NO_CARD}
    {...props}
  />
);
const workspaceTab = (props: WorkspaceTabProps = {}) => (
  <WorkspacePostSubmissionTab
    dict={dict}
    workspaceId="ws1"
    actionsAvailable
    confirmation={NO_CARD}
    {...props}
  />
);
const twoActions = {
  actions: ['post-submission-email-addresses', 'post-submission-log'].map((code) => ({
    code,
    name: code,
    scopes: ['workspace', 'form'],
    workspaceConfigurable: true,
    settings: formView,
  })),
};
/** Whether a drawer's header says it is open. */
const expanded = (testId: string) =>
  within(screen.getByTestId(testId)).getAllByRole('button')[0].getAttribute('aria-expanded');

let store: ReturnType<typeof makeStore>;

const renderTab = (tab: React.ReactNode) =>
  render(
    <Provider store={store}>
      <SWRConfig
        value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}
      >
        {tab}
      </SWRConfig>
    </Provider>,
  );

describe('After Submission tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store = makeStore();
    store.dispatch(setToken('token'));
    store.dispatch(setAuthenticated(true));
    // Each drawer's own read; these tests are about the list around them.
    mockGetFormSettings.mockImplementation((_token, _form, key: string) =>
      Promise.resolve(key === 'post-submission' ? { actions: [] } : formView),
    );
  });

  it("lists a form's actions in the server's order, under the form's intro", async () => {
    mockGetFormSettings.mockImplementation((_token, _form, key: string) =>
      Promise.resolve(key === 'post-submission' ? twoActions : formView),
    );
    renderTab(formTab());

    expect(await screen.findByTestId('post-submission-intro')).toHaveTextContent(
      en.postSubmission.formIntro,
    );
    const drawers = screen.getAllByTestId(/^accordion-post-submission-/);
    expect(drawers.map((drawer) => drawer.dataset.testid)).toEqual([
      'accordion-post-submission-email-addresses',
      'accordion-post-submission-log',
    ]);
    expect(mockGetFormSettings).toHaveBeenCalledWith('token', 'f1', 'post-submission');
  });

  it('says an administrator gives access when nothing is listed', async () => {
    renderTab(formTab());
    expect(await screen.findByTestId('post-submission-empty')).toHaveTextContent(
      en.postSubmission.empty,
    );
  });

  it('says After Submission is not available when the list is not found', async () => {
    mockGetFormSettings.mockRejectedValue(new ApiError('Not found', 404));
    renderTab(formTab());
    expect(await screen.findByTestId('post-submission-load-error')).toHaveTextContent(
      en.postSubmission.notAvailable,
    );
  });

  it('says the list did not load on any other failure', async () => {
    mockGetFormSettings.mockRejectedValue(new ApiError('Boom', 500));
    renderTab(formTab());
    expect(await screen.findByTestId('post-submission-load-error')).toHaveTextContent(
      en.postSubmission.loadError,
    );
  });

  it("says where a form's unknown workspace-only action is set", async () => {
    mockGetFormSettings.mockImplementation((_token, _form, key: string) =>
      Promise.resolve(
        key === 'post-submission'
          ? {
              actions: [
                {
                  code: 'post-submission-zip',
                  name: 'Zip the files',
                  scopes: ['workspace'],
                  workspaceConfigurable: true,
                  settings: formView,
                },
              ],
            }
          : formView,
      ),
    );
    renderTab(formTab());

    expect(await screen.findByTestId('post-submission-zip-unknown-note')).toHaveTextContent(
      en.postSubmission.workspaceOnlyNote,
    );
  });

  it('shows an action this build has no fields for as a read-only card', async () => {
    mockGetWorkspaceSettings.mockResolvedValue({
      actions: [
        {
          code: 'post-submission-zip',
          name: 'Zip the files',
          description: 'Zips the files of each submission',
          scopes: ['workspace'],
          settings: { values: { enabled: true, options: {} }, version: 2 },
        },
      ],
    });
    renderTab(workspaceTab());

    const card = await screen.findByTestId('post-submission-zip-unknown');
    expect(card).toHaveTextContent('Zips the files of each submission');
    expect(card).toHaveTextContent('Status: On');
    expect(card).toHaveTextContent(en.postSubmission.unknownAction);
    expect(screen.queryByTestId('post-submission-zip-unknown-note')).not.toBeInTheDocument();
    expect(screen.getByTestId('post-submission-intro')).toHaveTextContent(
      en.postSubmission.workspaceIntro,
    );
  });

  it('shows only a spinner while either check runs', () => {
    renderTab(formTab({ actionsAvailable: undefined }));
    expect(screen.queryByTestId('post-submission-intro')).not.toBeInTheDocument();
    renderTab(workspaceTab({ confirmation: undefined }));
    expect(screen.queryByTestId('post-submission-intro')).not.toBeInTheDocument();
  });

  describe('Confirmation Screen card', () => {
    const card = () => screen.findByText(dict.postSubmission.confirmationScreen.label);
    const settings = { allowSubmitterEmailCopy: true, showConfirmationId: true };
    const confirmationView = {
      inherit: true,
      own: null,
      workspace: settings,
      effective: settings,
      version: 1,
    };

    beforeEach(() => {
      mockGetWorkspaceSettings.mockImplementation((_token, _ws, key: string) =>
        Promise.resolve(
          key === 'post-submission' ? { actions: [] } : { values: settings, version: 1 },
        ),
      );
      mockGetFormSettings.mockImplementation((_token, _form, key: string) =>
        Promise.resolve(key === 'post-submission' ? { actions: [] } : confirmationView),
      );
    });

    it('shows after the actions where a setting is available', async () => {
      renderTab(workspaceTab({ confirmation: CARD }));
      expect(await card()).toBeInTheDocument();
    });

    it('is left out where no setting is available', async () => {
      renderTab(workspaceTab());
      expect(await screen.findByTestId('post-submission-empty')).toBeInTheDocument();
      expect(
        screen.queryByText(dict.postSubmission.confirmationScreen.label),
      ).not.toBeInTheDocument();
    });

    // Post-submission off: the tab is only the card, and the actions are never read.
    it('shows alone, reading no actions, where post-submission is off', async () => {
      renderTab(formTab({ actionsAvailable: false, confirmation: CARD }));
      expect(await card()).toBeInTheDocument();
      expect(screen.queryByTestId('post-submission-intro')).not.toBeInTheDocument();
      expect(screen.queryByTestId('post-submission-empty')).not.toBeInTheDocument();
      expect(mockGetFormSettings).not.toHaveBeenCalledWith('token', 'f1', 'post-submission');
    });

    it('stays when the actions fail to load', async () => {
      mockGetFormSettings.mockImplementation((_token, _form, key: string) =>
        key === 'post-submission'
          ? Promise.reject(new ApiError('boom', 500))
          : Promise.resolve(confirmationView),
      );
      renderTab(formTab({ confirmation: CARD }));
      expect(await screen.findByTestId('post-submission-load-error')).toBeInTheDocument();
      expect(await card()).toBeInTheDocument();
    });

    // The group reads which drawer opens only when it mounts, after the actions have loaded.
    it('opens the first action, not the card, when both show', async () => {
      const actions = ['post-submission-zip', 'post-submission-unzip'].map((code) => ({
        code,
        name: code,
        scopes: ['workspace', 'form'],
        workspaceConfigurable: true,
        settings: formView,
      }));
      mockGetFormSettings.mockImplementation((_token, _form, key: string) =>
        Promise.resolve(key === 'post-submission' ? { actions } : confirmationView),
      );
      renderTab(formTab({ confirmation: CARD }));
      expect(await card()).toBeInTheDocument();
      expect(expanded('accordion-post-submission-zip')).toBe('true');
      expect(expanded('accordion-confirmation-screen')).toBe('false');
    });

    it('opens the card when it is all the tab holds', async () => {
      renderTab(formTab({ actionsAvailable: false, confirmation: CARD }));
      expect(await card()).toBeInTheDocument();
      expect(expanded('accordion-confirmation-screen')).toBe('true');
    });
  });
});
