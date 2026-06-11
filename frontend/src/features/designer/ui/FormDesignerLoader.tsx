'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const FormForm = dynamic(() => import('./FormForm'), {
  ssr: false,
  loading: () => <div className="p-10 text-center">Loading Form Designer...</div>,
});

export default function FormDesignerLoader({ id }: { id?: string[] }) {
  return <FormForm id={id} />;
}
