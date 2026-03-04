'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useKeycloak } from '@/lib/useKeycloak';
import { useAppDispatch, useAppSelector } from '@/lib/store';
import { toggleMode } from '@/lib/slices/themeSlice';
import { useDictionary } from '../[lang]/Providers';
import { getNavigationItems } from '@/src/app/plugins/registry';

function Header() {
  const dict = useDictionary();
  const { authenticated, idTokenParsed, login, init } = useKeycloak();
  const dispatch = useAppDispatch();
  const isDark = useAppSelector((state) => state.theme.mode === 'dark');
  const navItems = getNavigationItems(dict.locale, dict);

  useEffect(() => {
    init();
  }, [init]);

  const handleLogin = () => {
    // login is a bound callback that dispatches the login thunk
    login();
  };

  const loginButton = () => {
    if (authenticated) {
      return (
        <span data-testid="logged-in-indicator">{`${dict.general.loggedAs} ${idTokenParsed?.display_name}`}</span>
      );
    }
    return (
      <button
        type="button"
        data-testid="login-button"
        className="btn-primary font-bold py-2 px-4 rounded"
        onClick={handleLogin}
      >
        {dict.general.login}
      </button>
    );
  };

  return (
    <header className="app-header px-4 py-3 border-b" role="banner">
      <div className="mx-auto max-w-6xl flex flex-wrap items-center gap-4" data-testid="app-header">
        <h1 className="text-2xl font-bold mr-auto">{dict.general.title}</h1>

        <nav aria-label="Primary" data-testid="primary-nav">
          <ul className="flex items-center gap-3">
            {navItems.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="font-semibold underline-offset-4 hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          className="rounded px-3 py-2 border"
          aria-label={dict.header.themeToggle ?? 'Toggle color theme'}
          aria-pressed={isDark}
          onClick={() => dispatch(toggleMode())}
          data-testid="theme-toggle-button"
        >
          {isDark ? 'Dark' : 'Light'}
        </button>

        <div className="min-w-48 text-right">{loginButton()}</div>
      </div>
    </header>
  );
}

export default Header;
export { Header };
