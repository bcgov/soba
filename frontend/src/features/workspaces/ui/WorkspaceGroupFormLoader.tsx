'use client';

import { clientOnly } from '@/src/shared/ui/clientOnly';

const WorkspaceGroupFormLoader = clientOnly(() => import('./WorkspaceGroupForm'));

export default WorkspaceGroupFormLoader;
