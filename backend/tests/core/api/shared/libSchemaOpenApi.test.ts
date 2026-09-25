import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { registerFormsOpenApi } from '../../../../src/core/api/forms/schema';
import { registerSubmissionsOpenApi } from '../../../../src/core/api/submissions/schema';
import { registerWorkspacesOpenApi } from '../../../../src/core/api/workspaces/schema';
import { registerAdminOpenApi } from '../../../../src/core/api/admin/schema';
import { registerMetaOpenApi } from '../../../../src/core/api/meta/schema';
import { registerMeOpenApi } from '../../../../src/core/api/me/schema';
import { registerFormSettingsOpenApi } from '../../../../src/features/form-settings';

function componentSchemas(): unknown {
  const registry = new OpenAPIRegistry();
  registerFormsOpenApi(registry);
  registerFormSettingsOpenApi(registry);
  registerSubmissionsOpenApi(registry);
  registerWorkspacesOpenApi(registry);
  registerAdminOpenApi(registry);
  registerMetaOpenApi(registry);
  registerMeOpenApi(registry);
  const doc = new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: { title: 'test', version: '1' },
  });
  return doc.components?.schemas;
}

const at = (node: unknown, ...path: (string | number)[]): unknown =>
  path.reduce<unknown>(
    (cur, key) => (cur as Record<string | number, unknown> | undefined)?.[key],
    node,
  );

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

// The response shapes come from @soba/lib. Nested schemas must still resolve to the named
// components, not be inlined into every response that uses them.
describe('OpenAPI components for lib-backed schemas', () => {
  const schemas = componentSchemas();

  it.each([
    ['Forms_ListFormsResponse', 'Forms_FormListItem', 'Forms_FormSort'],
    ['Forms_ListFormVersionsResponse', 'Forms_FormVersionListItem', 'Forms_FormVersionSort'],
    [
      'Submissions_ListSubmissionsResponse',
      'Submissions_SubmissionListItem',
      'Submissions_SubmissionSort',
    ],
    ['Workspaces_ListWorkspacesResponse', 'Workspaces_WorkspaceItem', 'Workspaces_WorkspaceSort'],
    ['Admin_ListSobaAdminsResponse', 'Admin_SobaAdminItem', 'Admin_SobaAdminSort'],
    ['Admin_ListFeatureScopesResponse', 'Admin_FeatureScopeItem', 'Admin_FeatureScopeSort'],
    [
      'Admin_ListDocumentGenerationAuditsResponse',
      'Admin_DocumentGenerationAuditItem',
      'Admin_DocgenAuditSort',
    ],
  ])('%s references its item, page and sort components', (list, item, sort) => {
    expect(at(schemas, list, 'properties', 'items', 'items')).toEqual(ref(item));
    expect(at(schemas, list, 'properties', 'page')).toEqual(ref('Core_OffsetPage'));
    expect(at(schemas, list, 'properties', 'sort')).toEqual(ref(sort));
  });

  it.each([
    ['Meta_PluginsResponse', 'plugins', 'Meta_PluginCatalogEntry'],
    ['Meta_FeaturesResponse', 'features', 'Meta_Feature'],
    ['Meta_FormEnginesResponse', 'items', 'Meta_FormEngine'],
    ['Meta_RolesResponse', 'roles', 'Meta_RoleWithSource'],
    ['Me_TenantsResponse', 'tenants', 'Me_Tenant'],
  ])('%s references its %s item component', (response, property, item) => {
    expect(at(schemas, response, 'properties', property, 'items')).toEqual(ref(item));
  });

  it.each([
    ['Me_Response', 'actor', 'Me_Actor'],
    ['Me_Response', 'profile', 'Me_Profile'],
    ['Me_Response', 'preferences', 'Me_Preferences'],
    ['Me_Response', 'capabilities', 'Me_Capabilities'],
    ['Me_PatchBody', 'preferences', 'Me_Preferences'],
  ])('%s references its %s component', (composite, property, child) => {
    expect(at(schemas, composite, 'properties', property)).toEqual(ref(child));
  });

  it.each([
    ['Workspaces_WorkspaceLookupResponse', 'Workspaces_WorkspaceLookupItem'],
    ['Forms_FormVersionLookupResponse', 'Forms_FormVersionSummary'],
  ])('%s references its item component', (response, item) => {
    expect(at(schemas, response, 'properties', 'items', 'items')).toEqual(ref(item));
    expect(at(schemas, response, 'required')).toEqual(
      expect.arrayContaining(['items', 'limit', 'truncated']),
    );
  });

  it('builds the codes response on the named code row', () => {
    expect(at(schemas, 'Meta_CodesKeyedResponse', 'additionalProperties', 'items')).toEqual(
      ref('Meta_CodeRowWithSource'),
    );
  });

  it('names the submitter settings response and body', () => {
    expect(
      at(schemas, 'FormSettings_Submitter', 'properties', 'allowSubmitterDrafts', 'type'),
    ).toBe('boolean');
    expect(at(schemas, 'FormSettings_SetSubmitterBody', 'required')).toEqual([
      'allowSubmitterDrafts',
    ]);
  });

  it('builds the form-with-version response on the named form response', () => {
    expect(at(schemas, 'Forms_FormWithVersionResponse', 'allOf', 0)).toEqual(
      ref('Forms_FormResponse'),
    );
  });
});
