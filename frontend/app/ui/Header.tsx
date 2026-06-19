'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Dropdown } from 'react-bootstrap';
import { Select, Header as BCHeader } from '@bcgov/design-system-react-components';
import { FaUser } from 'react-icons/fa6';
import { useAppDispatch } from '@/lib/store';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useClientMounted } from '@/lib/hooks/useClientMounted';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import { clearCurrentUser, loadCurrentUser } from '@/lib/slices/currentUserSlice';
import {
  loadWorkspaces,
  pickWorkspaceToEstablish,
  selectActiveWorkspace,
} from '@/lib/slices/workspaceSlice';
import { useAppSelector } from '@/lib/store';
import { useDictionary } from '../[lang]/Providers';
import { LoginButton } from './LoginButton';
import type { PluginNavItem } from '@/src/types/plugins';
import styles from './Header.module.css';

type HeaderProps = {
  headerNavItems: PluginNavItem[];
  overlayNavItems: PluginNavItem[];
};

/** Native select avoids React Aria auto-ids that can mismatch between SSR and hydration. */
function LanguageSelector({
  locale,
  onChange,
}: {
  locale: string;
  onChange: (locale: string) => void;
}) {
  return (
    <select
      id="lang-selector"
      data-testid="lang-selector"
      aria-label="Select Language"
      className="form-select form-select-sm mr-2"
      style={{ width: 'auto' }}
      value={locale}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="en">EN</option>
      <option value="fr">FR</option>
    </select>
  );
}

function Header({ headerNavItems }: HeaderProps) {
  const dispatch = useAppDispatch();
  const dict = useDictionary();
  const { addNotification } = useNotificationStore();

  const locale = dict.locale === 'en' || dict.locale === 'fr' ? dict.locale : 'en';
  const pathname = usePathname();
  const router = useRouter();
  const { authenticated, idTokenParsed, token, logout, init, refresh } = useKeycloak();
  const currentUser = useCurrentUser();
  const {
    workspaces,
    activeWorkspaceId,
    status: workspaceStatus,
  } = useAppSelector((state) => state.workspace);

  const headerChromeRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const establishingWorkspaceRef = useRef(false);
  const clientMounted = useClientMounted();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!authenticated || !token) {
      if (intervalRef) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      dispatch(clearCurrentUser());
      return;
    }
    if (currentUser.token !== token || currentUser.status === 'idle') {
      dispatch(loadCurrentUser(token));
    }

    if (authenticated && !intervalRef.current) {
      intervalRef.current = setInterval(() => {
        refresh();
      }, 30000);
    }
  }, [authenticated, token, currentUser.token, currentUser.status, dispatch, refresh]);

  useEffect(() => {
    if (authenticated && token && workspaceStatus === 'idle') {
      dispatch(loadWorkspaces(token));
    }
  }, [authenticated, token, workspaceStatus, dispatch]);

  // Establish the tab workspace through the backend so sobaFetch can capture the echoed
  // x-soba-workspace-id header into sessionStorage (soba.workspaceId). Without this,
  // users with a single workspace never see the chooser and nothing writes the store.
  useEffect(() => {
    if (
      !authenticated ||
      !token ||
      workspaceStatus !== 'succeeded' ||
      activeWorkspaceId ||
      establishingWorkspaceRef.current
    ) {
      return;
    }

    const target = pickWorkspaceToEstablish(workspaces);
    if (!target) return;

    establishingWorkspaceRef.current = true;
    void dispatch(selectActiveWorkspace({ token, workspaceId: target.id }))
      .unwrap()
      .catch((error) => {
        addNotification({
          text: dict.general.workspaceSwitchError,
          type: 'error',
          consoleError: error,
        });
      })
      .finally(() => {
        establishingWorkspaceRef.current = false;
      });
  }, [
    authenticated,
    token,
    workspaceStatus,
    activeWorkspaceId,
    workspaces,
    dispatch,
    addNotification,
    dict.general.workspaceSwitchError,
  ]);

  const handleLogout = () => {
    dispatch(clearCurrentUser());
    logout();
  };

  // Round-trip through GET /workspaces/:id so the backend verifies membership before we
  // persist the tab workspace to sessionStorage and Redux, then open the forms list.
  const handleWorkspaceChange = (key: string | number | null) => {
    if (!token || key == null) return;
    const workspaceId = String(key);
    if (workspaceId === activeWorkspaceId) return;
    void dispatch(selectActiveWorkspace({ token, workspaceId }))
      .unwrap()
      .then(() => {
        router.push(`/${locale}/forms`);
      })
      .catch((error) => {
        addNotification({
          text: dict.general.workspaceSwitchError,
          type: 'error',
          consoleError: error,
        });
      });
  };

  const handleLanguageChange = (newLocale: string) => {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
      router.push(newPath);
    } else {
      router.push(`/${newLocale}/`);
    }
  };

  const authActions = () => {
    const isCurrentTokenUser = currentUser.token === token;
    const backendDisplayName = isCurrentTokenUser ? currentUser.displayName : null;
    const keycloakDisplayName =
      typeof idTokenParsed?.display_name === 'string' && idTokenParsed.display_name.trim().length > 0
        ? idTokenParsed.display_name
        : null;
    const displayName =
      typeof backendDisplayName === 'string' && backendDisplayName.trim().length > 0
        ? backendDisplayName
        : isCurrentTokenUser && currentUser.hasError
          ? (keycloakDisplayName ?? 'Authenticated User')
          : isCurrentTokenUser && currentUser.isLoaded
            ? 'Authenticated User'
            : null;

    return (
      <div className="d-flex align-items-center justify-content-end gap-3">
        {authenticated && clientMounted && workspaces.length > 1 ? (
          <Select
            size="small"
            id="workspace-select"
            data-testid="workspace-select"
            aria-label="Select Workspace"
            className="mr-2"
            selectedKey={activeWorkspaceId || null}
            onSelectionChange={handleWorkspaceChange}
            items={workspaces.map((ws) => ({ id: ws.id, label: `${ws.name} (${ws.kind})` }))}
          />
        ) : null}

        <LanguageSelector locale={locale} onChange={handleLanguageChange} />

        {authenticated ? (
          displayName ? (
            <Dropdown>
              <Dropdown.Toggle className={styles.userDrop} data-testid="user-dropdown" id="dropdown-user">
                <FaUser className="align-text-top" aria-hidden="true" />
                <span className={styles.limitText + ' ms-2 me-2'}>{displayName}</span>
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item onClick={handleLogout} data-testid="logout-button">
                  {dict.general.logout}
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          ) : (
            <span
              aria-hidden="true"
              className="d-none d-md-inline-block"
              style={{
                width: '11rem',
                height: '1.25rem',
                background: 'var(--app-border)',
                borderRadius: '4px',
                opacity: 0.6,
              }}
            />
          )
        ) : (
          <LoginButton data-testid="login-button" label={dict.general.login} />
        )}
      </div>
    );
  };

  return (
    <div ref={headerChromeRef} data-testid="app-header">
      <BCHeader
        logoLinkElement={
          <Link href="/" data-testid="bcgov-header-logo" title="Government of British Columbia" />
        }
        title={dict.general.title}
        titleElement="h1"
        skipLinks={[
          <a key="skip-to-main" href="#main-content">
            {dict.header.skipToMain}
          </a>,
        ]}
      >
        <div className="d-flex align-items-center gap-3">
          {headerNavItems.length > 0 ? (
            <nav aria-label="Primary" data-testid="primary-nav" className="d-none d-md-block">
              <ul className="list-unstyled d-flex align-items-center gap-3 mb-0">
                {headerNavItems.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href} className="text-decoration-underline">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <div className="d-flex flex-shrink-0 align-items-center justify-content-end gap-3">
            {authActions()}
          </div>
        </div>
      </BCHeader>
    </div>
  );
}

export { Header };
