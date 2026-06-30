import {
  WorkspaceResolverDefinition,
  WorkspaceResolver,
  WorkspaceResolveInput,
  WorkspaceResolution,
} from '../../core/integrations/workspace/WorkspaceResolver';
import { PluginConfigReader } from '../../core/config/pluginConfig';
import { getWorkspaceForUser } from '../../core/db/repos/membershipRepo';

export interface PersonalLocalResolverSettings {
  cookieKey: string;
  allowHeaderOverride: boolean;
}

const readWorkspaceFromCookie = (
  cookieHeader: string | undefined,
  cookieKey: string,
): string | null => {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${cookieKey}=`));
  if (!match) return null;
  const [, value] = match.split('=');
  return value || null;
};

export class PersonalLocalResolver implements WorkspaceResolver {
  readonly code = 'personal-local';
  readonly kind = 'personal' as const;
  readonly priority = 50;
  readonly capabilities = {
    supportsHeaderResolution: true,
    supportsCookieResolution: true,
  };

  constructor(private readonly settings: PersonalLocalResolverSettings) {}

  async resolve(input: WorkspaceResolveInput): Promise<WorkspaceResolution | null> {
    const headerWorkspaceId = this.settings.allowHeaderOverride
      ? input.req.header('x-workspace-id')
      : null;
    const cookieWorkspaceId = readWorkspaceFromCookie(
      input.req.header('cookie'),
      this.settings.cookieKey,
    );
    const candidateWorkspaceId = headerWorkspaceId || cookieWorkspaceId;

    if (candidateWorkspaceId) {
      const memberWorkspace = await getWorkspaceForUser(candidateWorkspaceId, input.actorId);
      if (memberWorkspace && memberWorkspace.kind === 'personal') {
        return { workspaceId: candidateWorkspaceId, source: this.code };
      }
    }

    return null;
  }
}

export const workspacePluginDefinition: WorkspaceResolverDefinition = {
  code: 'personal-local',
  createResolver: (config: PluginConfigReader) =>
    new PersonalLocalResolver({
      cookieKey: config.getRequired('COOKIE_KEY'),
      allowHeaderOverride: config.getBoolean('ALLOW_HEADER_OVERRIDE'),
    }),
};
