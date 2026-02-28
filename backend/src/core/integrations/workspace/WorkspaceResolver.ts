import { Request } from 'express';
import { PluginConfigReader } from '../../config/pluginConfig';

export type WorkspacePluginCode = string;

export interface WorkspaceResolveInput {
  req: Request;
  actorId: string;
}

export interface WorkspaceResolution {
  workspaceId: string;
  source: string;
}

export interface WorkspaceResolverCapabilities {
  supportsHeaderResolution: boolean;
  supportsCookieResolution: boolean;
}

export interface WorkspaceResolver {
  readonly code: WorkspacePluginCode;
  readonly kind: 'personal' | 'enterprise';
  readonly priority: number;
  readonly capabilities: WorkspaceResolverCapabilities;
  resolve(input: WorkspaceResolveInput): Promise<WorkspaceResolution | null>;
}

export interface WorkspaceResolverDefinition {
  readonly code: WorkspacePluginCode;
  createResolver(config: PluginConfigReader): WorkspaceResolver;
}
