'use client';
import { useEffect } from 'react';
import {
  Button,
  Header as BcHeader,
  Heading,
  Link as BcLink,
  Text,
} from '@bcgov/design-system-react-components';
import { useAppDispatch } from '@/lib/store';
import { useKeycloak } from '@/lib/useKeycloak';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { clearCurrentUser, loadCurrentUser } from '@/lib/slices/currentUserSlice';
import { useDictionary } from '../[lang]/Providers';
import { getNavigationItems } from '@/src/app/plugins/registry';

function Header() {
  const dispatch = useAppDispatch();
  const dict = useDictionary();
  const { authenticated, idTokenParsed, token, login, logout, init } = useKeycloak();
  const currentUser = useCurrentUser();
  const locale = dict.locale === 'en' || dict.locale === 'fr' ? dict.locale : 'en';
  const navItems = getNavigationItems(locale, dict);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!authenticated || !token) {
      dispatch(clearCurrentUser());
      return;
    }
    if (currentUser.token !== token || currentUser.status === 'idle') {
      dispatch(loadCurrentUser(token));
    }
  }, [authenticated, token, currentUser.token, currentUser.status, dispatch]);

  const handleLogin = () => {
    // login is a bound callback that dispatches the login thunk
    login();
  };

  const handleLogout = () => {
    dispatch(clearCurrentUser());
    logout();
  };

  const authActions = () => {
    if (authenticated) {
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
            ? keycloakDisplayName ?? 'Authenticated User'
            : isCurrentTokenUser && currentUser.isLoaded
              ? 'Authenticated User'
              : null;
      return (
        <div className="flex items-center justify-end gap-3">
          {displayName ? (
            <Text data-testid="logged-in-indicator">{displayName}</Text>
          ) : (
            <span
              aria-hidden="true"
              className="inline-block h-5 w-44 rounded bg-[var(--surface-color-border-default)]/60 animate-pulse"
            />
          )}
          <Button
            id="logout-button"
            type="button"
            variant="secondary"
            size="medium"
            data-testid="logout-button"
            onClick={handleLogout}
          >
            {dict.general.logout}
          </Button>
        </div>
      );
    }
    return (
      <Button
        id="login-button"
        type="button"
        variant="primary"
        size="medium"
        data-testid="login-button"
        onClick={handleLogin}
      >
        {dict.general.login}
      </Button>
    );
  };

  return (
    <BcHeader
      title={dict.general.title}
      titleElement="h1"
      skipLinks={[
        <BcLink key="skip-main" href="#main-content" isUnstyled>
          {dict.header.skipToMain}
        </BcLink>,
      ]}
    >
      <div className="mx-auto max-w-6xl w-full flex flex-wrap items-center gap-4 px-4 py-3" data-testid="app-header">
        <Heading level={1} className="sr-only">
          {dict.general.title}
        </Heading>
        <nav aria-label="Primary" data-testid="primary-nav" className="mr-auto">
          <ul className="flex items-center gap-3">
            {navItems.map((item) => (
              <li key={item.id}>
                <BcLink href={item.href}>{item.label}</BcLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-48 text-right">{authActions()}</div>
      </div>
    </BcHeader>
  );
}

export default Header;
export { Header };
