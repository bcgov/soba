'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useDictionary } from '@/app/[lang]/Providers';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';

export function AuthRedirect({
  to,
  ifLogged,
  children,
}: {
  to: string;
  ifLogged: boolean;
  children: React.ReactNode;
}) {
  const { authenticated, initializing } = useKeycloak();
  const dict = useDictionary();
  const router = useRouter();
  const shouldRedirect =
    !initializing && ((ifLogged && authenticated) || (!ifLogged && !authenticated));

  useEffect(() => {
    if (shouldRedirect) {
      router.replace(to);
    }
  }, [shouldRedirect, router, to]);

  if (initializing || shouldRedirect) {
    return <CenteredProgress label={dict.general.loading} minHeight="50vh" />;
  }

  return <>{children}</>;
}
