import {
  WorkspaceResolverDefinition,
  WorkspaceResolver,
  WorkspaceResolveInput,
  WorkspaceResolution,
} from '../../core/integrations/workspace/WorkspaceResolver';
import { PluginConfigReader } from '../../core/config/pluginConfig';
import { getWorkspaceForUser } from '../../core/db/repos/membershipRepo';
import { findWorkspaceByEnterpriseExternalId } from '../../core/db/repos/plugins/enterpriseBindingRepo';

export interface EnterpriseCstarResolverSettings {
  headerKeys: string[];
  requireExternalHeader: boolean;
}

export class EnterpriseCstarResolver implements WorkspaceResolver {
  readonly code = 'enterprise-cstar';
  readonly kind = 'enterprise' as const;
  readonly priority = 10;
  readonly capabilities = {
    supportsHeaderResolution: true,
    supportsCookieResolution: false,
  };

  constructor(private readonly settings: EnterpriseCstarResolverSettings) {}

  async resolve(input: WorkspaceResolveInput): Promise<WorkspaceResolution | null> {
    const explicitWorkspaceId = input.req.header('x-workspace-id');
    if (explicitWorkspaceId && !this.settings.requireExternalHeader) {
      const workspace = await getWorkspaceForUser(explicitWorkspaceId, input.actorId);
      if (workspace && workspace.kind === 'enterprise') {
        return { workspaceId: explicitWorkspaceId, source: this.code };
      }
    }

    const externalWorkspaceId =
      this.settings.headerKeys
        .map((headerKey) => input.req.header(headerKey))
        .find((value): value is string => Boolean(value)) ?? null;
    if (!externalWorkspaceId) {
      return null;
    }

    const workspaceId = await findWorkspaceByEnterpriseExternalId('cstar', externalWorkspaceId);
    if (!workspaceId) {
      return null;
    }

    const workspace = await getWorkspaceForUser(workspaceId, input.actorId);
    if (!workspace || workspace.kind !== 'enterprise') {
      return null;
    }

    return { workspaceId, source: this.code };
  }
}

export const workspacePluginDefinition: WorkspaceResolverDefinition = {
  code: 'enterprise-cstar',
  createResolver: (config: PluginConfigReader) =>
    new EnterpriseCstarResolver({
      headerKeys: config.getCsv('HEADER_KEYS'),
      requireExternalHeader: config.getBoolean('REQUIRE_EXTERNAL_HEADER'),
    }),
};
