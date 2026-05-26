'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Button,
  Header as BcHeader,
  Heading,
  Link as BcLink,
  SvgCloseIcon,
  Text,
} from '@bcgov/design-system-react-components';
import { useAppDispatch } from '@/lib/store';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { clearCurrentUser, loadCurrentUser } from '@/lib/slices/currentUserSlice';
import { useDictionary } from '../[lang]/Providers';
import type { PluginNavItem } from '@/src/app/plugins/types';
import { NavOverlay } from './NavOverlay';

const NAV_MENU_PANEL_ID = 'nav-menu-panel';

function MenuHamburgerIcon() {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="shrink-0 text-[var(--typography-color-primary)]"
    >
      <path
        d="M20.0358 17.8571C20.558 17.8571 21 18.2991 21 18.8616C21 19.3839 20.558 19.7857 20.0358 19.7857H3.92411C3.40179 19.7857 3 19.3839 3 18.8214C3 18.2991 3.40179 17.8571 3.92411 17.8571H20.0358ZM20.0358 5C20.558 5 21 5.52232 21 6.00447C21 6.52678 20.558 6.92857 20.0358 6.92857H3.92411C3.40179 6.92857 3 6.44644 3 5.96429C3 5.44196 3.40179 5 3.92411 5H20.0358ZM20.0358 11.4286C20.558 11.4286 21 11.8705 21 12.3929C21 12.9554 20.558 13.3571 20.0358 13.3571H3.92411C3.40179 13.3571 3 12.9554 3 12.3929C3 11.8705 3.40179 11.4286 3.92411 11.4286H20.0358Z"
        fill="currentColor"
      />
    </svg>
  );
}

export type HeaderProps = {
  headerNavItems: PluginNavItem[];
  overlayNavItems: PluginNavItem[];
};

function Header({ headerNavItems, overlayNavItems }: HeaderProps) {
  const dispatch = useAppDispatch();
  const dict = useDictionary();

  const locale = dict.locale === 'en' || dict.locale === 'fr' ? dict.locale : 'en';
  const homeHref = `/${locale}/`;
  const pathname = usePathname();
  const { authenticated, idTokenParsed, token, login, logout, init, refresh } = useKeycloak();
  const currentUser = useCurrentUser();

  const [menuOpen, setMenuOpen] = useState(false);
  const [headerBottomPx, setHeaderBottomPx] = useState(88);
  const headerChromeRef = useRef<HTMLDivElement>(null);
  const wasMenuOpenRef = useRef(false);
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
    queueMicrotask(() => {
      setMenuOpen((open) => (open ? false : open));
    });
  }, [pathname]);

  useEffect(() => {
    if (wasMenuOpenRef.current && !menuOpen) {
      document.getElementById('nav-menu-button')?.focus();
    }
    wasMenuOpenRef.current = menuOpen;
  }, [menuOpen]);

  const measureHeaderBottom = useCallback(() => {
    const el = headerChromeRef.current;
    if (!el) return;
    const headerEl = el.querySelector<HTMLElement>('header.bcds-header');
    const target = headerEl ?? el;
    setHeaderBottomPx(Math.ceil(target.getBoundingClientRect().bottom));
  }, []);

  useLayoutEffect(() => {
    const el = headerChromeRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measureHeaderBottom());
    ro.observe(el);
    const headerEl = el.querySelector<HTMLElement>('header.bcds-header');
    if (headerEl) ro.observe(headerEl);
    window.addEventListener('resize', measureHeaderBottom);
    const raf = requestAnimationFrame(() => measureHeaderBottom());
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', measureHeaderBottom);
    };
  }, [measureHeaderBottom]);

  useLayoutEffect(() => {
    if (!menuOpen) return;
    const raf = requestAnimationFrame(() => measureHeaderBottom());
    return () => cancelAnimationFrame(raf);
  }, [menuOpen, measureHeaderBottom]);

  const closeMenu = () => setMenuOpen(false);
  const toggleMenu = () => setMenuOpen((open) => !open);

  const handleLogin = () => {
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
    <>
      <div ref={headerChromeRef}>
        <BcHeader
          title={dict.general.title}
          titleElement="h1"
          logoLinkElement={<Link href={homeHref} title="Government of British Columbia" />}
          skipLinks={[
            <BcLink key="skip-main" href="#main-content" isUnstyled>
              {dict.header.skipToMain}
            </BcLink>,
          ]}
        >
          <div
            className="mx-auto max-w-6xl w-full flex flex-wrap items-center gap-4 px-4 py-3"
            data-testid="app-header"
          >
            <Heading level={1} className="sr-only">
              {dict.general.title}
            </Heading>
            {headerNavItems.length > 0 ? (
              <nav
                aria-label="Primary"
                data-testid="primary-nav"
                className="mr-auto hidden md:block"
              >
                <ul className="flex items-center gap-3">
                  {headerNavItems.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="underline underline-offset-[var(--layout-padding-hair)]"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
            <div
              className={`flex shrink-0 items-center justify-end gap-3 md:min-w-48 ${headerNavItems.length > 0 ? 'ml-auto md:ml-0' : 'ml-auto'}`}
            >
              <div className="text-right">{authActions()}</div>
              <Button
                id="nav-menu-button"
                type="button"
                variant="secondary"
                size="medium"
                className="shrink-0"
                data-testid="nav-menu-button"
                aria-expanded={menuOpen}
                aria-controls={NAV_MENU_PANEL_ID}
                aria-label={menuOpen ? dict.header.closeMenuAria : dict.header.openMenuAria}
                onClick={toggleMenu}
              >
                <span className="inline-flex items-center gap-2">
                  {menuOpen ? (
                    <>
                      <span className="hidden sm:inline">{dict.header.closeMenu}</span>
                      <SvgCloseIcon />
                    </>
                  ) : (
                    <>
                      <span className="hidden sm:inline">{dict.header.menu}</span>
                      <MenuHamburgerIcon />
                    </>
                  )}
                </span>
              </Button>
            </div>
          </div>
        </BcHeader>
      </div>
      <NavOverlay
        open={menuOpen}
        onClose={closeMenu}
        topPx={headerBottomPx}
        navItems={overlayNavItems}
        panelTitle={dict.header.mobileNavLabel}
        panelId={NAV_MENU_PANEL_ID}
      />
    </>
  );
}

export default Header;
export { Header };
