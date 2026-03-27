'use client';

import dynamic from 'next/dynamic';
import { useState, useMemo } from 'react';
import { useDictionary } from '@/app/[lang]/Providers';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { FormType } from '@formio/react';

const FormBuilder = dynamic(() => import('@formio/react').then((mod) => mod.FormBuilder), {
  ssr: false,
});

const FormioProvider = dynamic(() => import('@formio/react').then((mod) => mod.FormioProvider), {
  ssr: false,
});

interface DesignerProps {
  // The magic happens here: a function prop that accepts our model
  onUpdateModel: (data: FormType) => void;
}

const FormDesigner: React.FC<DesignerProps> = ({ onUpdateModel }) => {
  const { authenticated, initializing } = useKeycloak();
  const dict = useDictionary();
  const [schema, setSchema] = useState<Partial<FormType>>({
    display: 'form',
    components: [],
  });

  const opt = useMemo(
    () => ({
      language: dict.locale,
      i18n: {
        [dict.locale]: dict,
      },
      builder: {
        premium: false,
      },
    }),
    [dict.locale, dict],
  );

  // This function captures the updated JSON schema
  const handleSchemaChange = (updatedSchema: FormType) => {
    setSchema(updatedSchema);
    onUpdateModel(updatedSchema);
  };

  if (initializing) {
    return <div>Forms Initializing</div>;
  }

  if (!authenticated) {
    return <div>You must be logged in</div>;
  }

  return (
    <section className="p-4" data-testid="workspace-page" aria-labelledby="workspace-heading">
      <FormioProvider
        baseUrl={process.env.NEXT_PUBLIC_SOBA_API_BASE_URL + '/formio-v5'}
        projectUrl={process.env.NEXT_PUBLIC_SOBA_API_BASE_URL + '/formio-v5'}
      >
        <FormBuilder options={opt} onChange={handleSchemaChange} />
      </FormioProvider>
    </section>
  );
};

export default FormDesigner;
