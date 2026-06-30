'use client';

import { clientOnly } from '@/src/shared/ui/clientOnly';

const WorkspaceFormLoader = clientOnly(() => import('./WorkspaceForm'));

export default WorkspaceFormLoader;
