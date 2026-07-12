'use client';

import { clientOnly } from '@/src/shared/ui/clientOnly';

const FormioV5SubmissionFillLoader = clientOnly(() => import('./FormioV5SubmissionFillClient'));

export default FormioV5SubmissionFillLoader;
