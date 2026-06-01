'use client';

import { useEffect, useState } from 'react';
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
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!initializing) {
      if (ifLogged && authenticated) {
        setRedirecting(true);
        router.replace(to);
      } else if (!ifLogged && !authenticated) {
        setRedirecting(true);
        router.replace(to);
      }
    }
  }, [authenticated, initializing, to, ifLogged, router]);

  if (initializing || redirecting) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
        <Spinner animation="border" />
      </div>
    );
  }

  return <>{children}</>;
}
