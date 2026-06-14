'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';

const FormForm = dynamic(() => import('./FormForm'), {
  ssr: false,
  loading: () => <CenteredProgress />,
});

export default function FormDesignerLoader({ id }: { id?: string[] }) {
  return <FormForm id={id} />;
}
