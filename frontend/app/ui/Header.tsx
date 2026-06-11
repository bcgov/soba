'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import bcgovLogo from '../../public/bcgov-logo.png';
import { usePathname, useRouter } from 'next/navigation';
import { Form, Dropdown, Navbar, Container } from 'react-bootstrap';
import { FaUser } from 'react-icons/fa6';
import { useAppDispatch } from '@/lib/store';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { clearCurrentUser, loadCurrentUser } from '@/lib/slices/currentUserSlice';
import { loadWorkspaces, setActiveWorkspaceId } from '@/lib/slices/workspaceSlice';
import { useAppSelector } from '@/lib/store';
import { useDictionary } from '../[lang]/Providers';
import { LoginButton } from './LoginButton';
import type { PluginNavItem } from '@/src/types/plugins';
import styles from './Header.module.css';

type HeaderProps = {
  headerNavItems: PluginNavItem[];
  overlayNavItems: PluginNavItem[];
};

function Header({ headerNavItems }: HeaderProps) {
  const dispatch = useAppDispatch();
  const dict = useDictionary();

  const locale = dict.locale === 'en' || dict.locale === 'fr' ? dict.locale : 'en';
  const homeHref = `/${locale}/`;
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

  const handleLogout = () => {
    dispatch(clearCurrentUser());
    logout();
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
    if (authenticated) {
      const isCurrentTokenUser = currentUser.token === token;
      const backendDisplayName = isCurrentTokenUser ? currentUser.displayName : null;
      const keycloakDisplayName =
        typeof idTokenParsed?.display_name === 'string' &&
        idTokenParsed.display_name.trim().length > 0
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
          {workspaces.length > 1 && (
            <Form.Select
              size="sm"
              id="workspace-select"
              data-testid="workspace-select"
              value={activeWorkspaceId || ''}
              onChange={(e) => dispatch(setActiveWorkspaceId(e.target.value))}
              style={{ width: 'auto', maxWidth: '200px' }}
              className="mr-2"
              aria-label="Select Workspace"
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name} ({ws.kind})
                </option>
              ))}
            </Form.Select>
          )}

          <Form.Select
            size="sm"
            value={locale}
            id="lang-selector"
            data-testid="lang-selector"
            onChange={(e) => handleLanguageChange(e.target.value)}
            style={{ width: 'auto' }}
            className="mr-2"
            aria-label="Select Language"
          >
            <option value="en">EN</option>
            <option value="fr">FR</option>
          </Form.Select>

          {displayName ? (
            <Dropdown>
              <Dropdown.Toggle className={styles.userDrop} data-testid="user-dropdown" id="dropdown-user">
                <FaUser className="align-text-top" />
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
          )}
        </div>
      );
    }
    return (
      <div className="d-flex align-items-center justify-content-end gap-3">
        <Form.Select
          size="sm"
          id="lang-selector"
          value={locale}
          data-testid="lang-selector"
          onChange={(e) => handleLanguageChange(e.target.value)}
          style={{ width: 'auto' }}
          className="mr-2"
          aria-label="Select Language"
        >
          <option value="en">EN</option>
          <option value="fr">FR</option>
        </Form.Select>
        <LoginButton data-testid="header-login-button" label={dict.general.login} />
      </div>
    );
  };

  return (
    <>
      <div ref={headerChromeRef}>
        <header>
          <a href="#main-content" className="visually-hidden-focusable">
            {dict.header.skipToMain}
          </a>
          <Navbar className="bc-gov-header py-2" expand="md" data-testid="app-header">
            <Container fluid="xl" className="px-3 px-sm-4 gap-3">
              <Link
                href={homeHref}
                data-testid="bcgov-header-logo"
                title="Government of British Columbia"
                className="navbar-brand mb-0 d-flex align-items-center gap-2"
              >
                <Image
                  src={bcgovLogo}
                  alt="BC Gov logo"
                  height={40}
                  width={160}
                  style={{ height: '2.5rem', width: 'auto', marginRight: '0.5rem' }}
                  aria-hidden="true"
                  priority
                  draggable={false}
                  className="border-end text-decoration-none"
                />
                {dict.general.title}
              </Link>
              <h1 className="visually-hidden">{dict.general.title}</h1>
              {headerNavItems.length > 0 ? (
                <nav
                  aria-label="Primary"
                  data-testid="primary-nav"
                  className="me-auto d-none d-md-block"
                >
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
              <div
                className={`d-flex flex-shrink-0 align-items-center justify-content-end gap-3 ${headerNavItems.length > 0 ? 'ms-auto' : 'ms-auto'}`}
              >
                {authActions()}
              </div>
            </Container>
          </Navbar>
        </header>
      </div>
    </>
  );
}

export { Header };
