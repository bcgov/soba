'use client';

import { clientOnly } from '@/src/shared/ui/clientOnly';

const FormioV5FormRenderLoader = clientOnly(() => import('./FormioV5FormRenderClient'));

export default FormioV5FormRenderLoader;
