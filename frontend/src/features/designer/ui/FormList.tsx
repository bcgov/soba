'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { useKeycloak } from '@/lib/hooks/useKeycloak';

import 'bootstrap/dist/css/bootstrap.min.css';
import '@formio/js/dist/formio.full.min.css';

const FormGrid = dynamic(() => import('@formio/react').then((mod) => mod.FormGrid), { ssr: false });
const FormioProvider = dynamic(() => import('@formio/react').then((mod) => mod.FormioProvider), {
  ssr: false,
});

function FormList() {
  const { authenticated, token, initializing } = useKeycloak();

  // Show a loader while we are waiting for Keycloak AND the Formio patch
  if (initializing || (authenticated && !token)) {
    return <div className="p-4">Initializing Auth & Form Engine...</div>;
  }

  if (!authenticated) {
    return <div className="p-4">Please log in to view your forms.</div>;
  }

  return (
    <section className="p-4">
      <FormioProvider
        baseUrl={process.env.NEXT_PUBLIC_SOBA_API_BASE_URL + '/formio-v5'}
        projectUrl={process.env.NEXT_PUBLIC_SOBA_API_BASE_URL + '/formio-v5'}
      >
        <FormGrid />
      </FormioProvider>
    </section>
  );
}

export default FormList;
