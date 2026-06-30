'use client';

import { clientOnly } from '@/src/shared/ui/clientOnly';

const FormDesignerLoader = clientOnly(() => import('./FormForm'));

export default FormDesignerLoader;
