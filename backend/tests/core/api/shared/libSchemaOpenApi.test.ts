import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { registerFormsOpenApi } from '../../../../src/core/api/forms/schema';
import { registerSubmissionsOpenApi } from '../../../../src/core/api/submissions/schema';
import { registerWorkspacesOpenApi } from '../../../../src/core/api/workspaces/schema';

function componentSchemas(): unknown {
  const registry = new OpenAPIRegistry();
  registerFormsOpenApi(registry);
  registerSubmissionsOpenApi(registry);
  registerWorkspacesOpenApi(registry);
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
    [
      'Submissions_ListSubmissionsResponse',
      'Submissions_SubmissionListItem',
      'Submissions_SubmissionSort',
    ],
    ['Workspaces_ListWorkspacesResponse', 'Workspaces_WorkspaceItem', 'Workspaces_WorkspaceSort'],
  ])('%s references its item, page and sort components', (list, item, sort) => {
    expect(at(schemas, list, 'properties', 'items', 'items')).toEqual(ref(item));
    expect(at(schemas, list, 'properties', 'page')).toEqual(ref('Core_OffsetPage'));
    expect(at(schemas, list, 'properties', 'sort')).toEqual(ref(sort));
  });

  it('builds the form-with-version response on the named form response', () => {
    expect(at(schemas, 'Forms_FormWithVersionResponse', 'allOf', 0)).toEqual(
      ref('Forms_FormResponse'),
    );
  });
});
