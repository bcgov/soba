'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

import { useDictionary } from '@/app/[lang]/Providers';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { WorkspaceItem } from '@/src/shared/api/sobaApi';

import 'bootstrap/dist/css/bootstrap.min.css';
import '@formio/js/dist/formio.full.min.css';
import '@formio/js/dist/formio.builder.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css'; // Better for Next.js than CDN
import { Formio } from '@formio/js/embed';

const FormGrid = dynamic(() => import('@formio/react').then((mod) => mod.FormGrid), {
  ssr: false,
});

const FormioProvider = dynamic(() => import('@formio/react').then((mod) => mod.FormioProvider), {
  ssr: false,
});

function FormList() {
  const { authenticated, token, initializing } = useKeycloak();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  return (
    <section className="p-4" data-testid="workspace-page" aria-labelledby="workspace-heading">
      {loading || (initializing && <p>Loading...</p>)}
      {!authenticated && !initializing && <p>Please log in to view your forms.</p>}
      {!loading && !initializing && (
        <FormioProvider
          baseUrl={process.env.NEXT_PUBLIC_SOBA_API_BASE_URL + '/formio-v5'}
          projectUrl={process.env.NEXT_PUBLIC_SOBA_API_BASE_URL + '/formio-v5'}
        >
          <FormGrid />
        </FormioProvider>
      )}
    </section>
  );
}

export default FormList;
