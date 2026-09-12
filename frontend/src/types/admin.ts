/** Platform-administration payloads served by the backend `/admin/*` routes. */
import type { ListQueryArgs } from './list';

export type {
  SobaAdminItem,
  ListSobaAdminsResponse as SobaAdminsResponse,
  FeatureScopeItem,
  ListFeatureScopesResponse as FeatureScopesResponse,
  UpsertFeatureScopeBody,
  DocumentGenerationAuditItem,
  ListDocumentGenerationAuditsResponse as DocumentGenerationAuditsResponse,
} from '@soba/lib';

export type FeatureScopeType = 'workspace' | 'form';

export type FeatureScopeStatus = 'active' | 'inactive';

export type DocumentGenerationAuditsQuery = ListQueryArgs & {
  workspaceId?: string;
  formId?: string;
};
