'use client';

import dynamic from 'next/dynamic';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useDictionary } from '@/app/[lang]/Providers';
import { useRouter, usePathname } from 'next/navigation';
import { getLocaleFromPath } from '@/src/shared/util/locale';

import 'bootstrap/dist/css/bootstrap.min.css';
import '@formio/js/dist/formio.full.min.css';

const FormGrid = dynamic(() => import('@formio/react').then((mod) => mod.FormGrid), { ssr: false });
const FormioProvider = dynamic(() => import('@formio/react').then((mod) => mod.FormioProvider), {
  ssr: false,
});

type Action = { name: string };

interface FormActionButtonProps {
  action: Action;
  onClick: () => void;
  row?: { _id: string; id?: string };
  form?: { _id: string; id?: string };
}

const CustomActionButtons = ({ action, onClick }: FormActionButtonProps) => {
  const dict = useDictionary();
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname);

  const handleAction = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const spyFn = (capturedId: string) => {
      if (capturedId) {
        router.push(`/${locale}/forms/${capturedId}`);
      }
    };

    action.fn = spyFn;

    onClick();
  };

  if (action.name.toLowerCase() === 'delete') {
    return (
      <button type="button" onClick={handleAction} className="btn btn-primary btn-sm">
        {/* We are visually replacing "Delete" with "Edit" or "Load" */}
        {dict.form.input || 'Input Data'}
      </button>
    );
  }

  return (
    <button onClick={onClick} className="btn btn-primary btn-sm">
      {dict.form[action.name.toLowerCase()] || action.name}
    </button>
  );
};

function FormList() {
  const { authenticated, token, initializing } = useKeycloak();
  const dict = useDictionary();
  const router = useRouter();
  const pathname = usePathname();

  // Show a loader while we are waiting for Keycloak AND the Formio patch
  if (initializing || (authenticated && !token)) {
    return <div className="p-4">{dict.form.loading}</div>;
  }

  if (!authenticated) {
    return <div className="p-4">{dict.form.notAuthenticated}</div>;
  }

  const gridComponents = {
    FormActionButton: CustomActionButtons,
  };

  const locale = getLocaleFromPath(pathname);

  const handleFormClick = (id: string) => {
    if (id) {
      router.push(`/${locale}/designer/${id}`);
    }
  };

  return (
    <section className="p-4">
      <FormioProvider
        baseUrl={process.env.NEXT_PUBLIC_SOBA_API_BASE_URL + '/forms/formio'}
        projectUrl={process.env.NEXT_PUBLIC_SOBA_API_BASE_URL + '/forms/formio'}
      >
        <FormGrid components={gridComponents} onFormClick={handleFormClick} />
      </FormioProvider>
    </section>
  );
}

export default FormList;
