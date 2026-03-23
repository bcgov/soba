'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useDictionary } from '@/app/[lang]/Providers';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { WorkspaceItem } from '@/src/shared/api/sobaApi';

import 'bootstrap/dist/css/bootstrap.min.css';
import '@formio/js/dist/formio.full.min.css';
import '@formio/js/dist/formio.builder.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css'; // Better for Next.js than CDN

const FormBuilder = dynamic(() => import('@formio/react').then((mod) => mod.FormBuilder), {
  ssr: false,
});

const FormioProvider = dynamic(() => import('@formio/react').then((mod) => mod.FormioProvider), {
  ssr: false,
});

function FormDesigner() {
  const dict = useDictionary();
  const { authenticated, token, initializing } = useKeycloak();
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const opt = {
    language: dict.locale,
    i18n: {
      [dict.locale]: dict,
    },
    builder: {
      premium: false,
    },
  };

  return (
    <section className="p-4" data-testid="workspace-page" aria-labelledby="workspace-heading">
      <FormioProvider
        baseUrl={process.env.NEXT_PUBLIC_SOBA_API_BASE_URL + '/formio-v5'}
        projectUrl={process.env.NEXT_PUBLIC_SOBA_API_BASE_URL + '/formio-v5'}
      >
        <FormBuilder options={opt} />
      </FormioProvider>
    </section>
  );
}

export default FormDesigner;
