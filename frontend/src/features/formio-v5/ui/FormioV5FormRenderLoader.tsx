'use client';

import dynamic from 'next/dynamic';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';

const FormioV5FormRenderClient = dynamic(() => import('./FormioV5FormRenderClient'), {
  ssr: false,
  loading: () => <CenteredProgress />,
});

export default function FormioV5FormRenderLoader() {
  return <FormioV5FormRenderClient />;
}
