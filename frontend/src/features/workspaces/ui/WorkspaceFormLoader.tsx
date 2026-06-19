'use client';

import dynamic from 'next/dynamic';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';

const WorkspaceForm = dynamic(() => import('./WorkspaceForm'), {
  ssr: false,
  loading: () => <CenteredProgress />,
});

type WorkspaceFormLoaderProps = {
  workspaceId?: string;
};

export default function WorkspaceFormLoader({ workspaceId }: WorkspaceFormLoaderProps) {
  return <WorkspaceForm workspaceId={workspaceId} />;
}
