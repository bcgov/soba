import type { CoreDomain } from '../shared/openapi';
import { documentGenerationRouter } from './route';
import { registerDocumentGenerationOpenApi } from './schema';

export const documentGenerationDomain: CoreDomain = {
  path: '/',
  router: documentGenerationRouter,
  registerOpenApi: registerDocumentGenerationOpenApi,
};
