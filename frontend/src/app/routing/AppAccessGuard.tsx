'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import { useDictionary } from '@/app/[lang]/Providers';
import { resolveRedirect } from './appRoutePolicy';
import { useAppSession } from './useAppSession';

type AppAccessGuardProps = {
  locale: string;
  children: React.ReactNode;
};

/** Central session bootstrap and route access policy for localized app routes. */
export function AppAccessGuard({ locale, children }: AppAccessGuardProps) {
  const dict = useDictionary();
  const router = useRouter();
  const pathname = usePathname();
  const session = useAppSession();

  const redirectTarget = useMemo(() => {
    return resolveRedirect(pathname, locale, session);
  }, [pathname, locale, session]);

  useEffect(() => {
    if (redirectTarget) {
      router.replace(redirectTarget);
    }
  }, [redirectTarget, router]);

  const showLoading =
    session.initializing ||
    (session.authenticated && !session.sessionReady) ||
    redirectTarget !== null;

  if (showLoading) {
    return <CenteredProgress label={dict.general.loading} minHeight="50vh" />;
  }

  return <>{children}</>;
}
