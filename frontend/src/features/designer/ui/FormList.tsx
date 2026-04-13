'use client';

import dynamic from 'next/dynamic';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useRouter, usePathname } from 'next/navigation';
import { getLocaleFromPath } from '@/src/shared/util/locale';

import 'bootstrap/dist/css/bootstrap.min.css';
import '@formio/js/dist/formio.full.min.css';

const FormGrid = dynamic(() => import('@formio/react').then((mod) => mod.FormGrid), { ssr: false });
const FormioProvider = dynamic(() => import('@formio/react').then((mod) => mod.FormioProvider), {
  ssr: false,
});

interface FormActionButtonProps {
  action: Action;
  onClick: () => void;
}

const CustomActionButtons = ({ action, onClick }: FormActionButtonProps) => {
  //remove delete, maybe just for now?
  if (action.name.toLowerCase() === 'delete') {
    return <></>;
  }

  // Otherwise, return a standard button (or your own custom UI)
  return (
    <button onClick={onClick} className="btn btn-primary btn-sm">
      {action.name}
    </button>
  );
};

function FormList() {
  const { authenticated, token, initializing } = useKeycloak();
  const router = useRouter();
  const pathname = usePathname();

  // Show a loader while we are waiting for Keycloak AND the Formio patch
  if (initializing || (authenticated && !token)) {
    return <div className="p-4">Initializing Auth & Form Engine...</div>;
  }

  if (!authenticated) {
    return <div className="p-4">Please log in to view your forms.</div>;
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
        baseUrl={process.env.NEXT_PUBLIC_SOBA_API_BASE_URL + '/formio-v5'}
        projectUrl={process.env.NEXT_PUBLIC_SOBA_API_BASE_URL + '/formio-v5'}
      >
        <FormGrid components={gridComponents} onFormClick={handleFormClick} />
      </FormioProvider>
    </section>
  );
}

export default FormList;
