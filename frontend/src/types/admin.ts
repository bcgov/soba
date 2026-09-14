/** Platform-administration payloads served by the backend `/admin/*` routes. */
import type { FeatureScopeItem } from '@soba/lib';
import type { ListQueryArgs } from './list';

export type {
  SobaAdminItem,
  ListSobaAdminsResponse as SobaAdminsResponse,
  AddSobaAdminBody,
  FeatureScopeItem,
  ListFeatureScopesResponse as FeatureScopesResponse,
  UpsertFeatureScopeBody,
  DocumentGenerationAuditItem,
  ListDocumentGenerationAuditsResponse as DocumentGenerationAuditsResponse,
} from '@soba/lib';

export type FeatureScopeType = FeatureScopeItem['scopeType'];

export type FeatureScopeStatus = FeatureScopeItem['status'];

export type DocumentGenerationAuditsQuery = ListQueryArgs & {
  workspaceId?: string;
  formId?: string;
};
