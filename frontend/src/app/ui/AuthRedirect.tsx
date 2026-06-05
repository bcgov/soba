'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { Spinner } from 'react-bootstrap';

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
  const router = useRouter();
  const shouldRedirect =
    !initializing && ((ifLogged && authenticated) || (!ifLogged && !authenticated));

  useEffect(() => {
    if (shouldRedirect) {
      router.replace(to);
    }
  }, [shouldRedirect, router, to]);

  if (initializing || shouldRedirect) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: '50vh' }}
      >
        <Spinner animation="border" />
      </div>
    );
  }

  return <>{children}</>;
}
