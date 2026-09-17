import { z } from 'zod';
import type { FormCreateCapability, MeResponse } from '@soba/lib';
import { findAppUserById, updateAppUserProfile } from '../../db/repos/appUserRepo';
import { toAppUserView } from '../../db/appUserView';
import { canCreateWorkspaceByIdp } from '../../db/repos/idpGroupRepo';
import {
  actorBelongsToWorkspace,
  findPermittedWorkspace,
  hasActiveMembership,
} from '../../db/repos/membershipRepo';
import { FormCreatePermissions } from '../../db/codes';
import { profileHelpers, type StoredProfile } from '../../auth/jwtClaims';
import { ForbiddenError } from '../../errors';
import { PatchMeBodySchema } from './schema';

type PatchMeBody = z.infer<typeof PatchMeBodySchema>;

export class MeApiService {
  private async resolveDefaultWorkspaceId(
    actorId: string,
    profile: StoredProfile | null | undefined,
  ): Promise<string | null> {
    const stored = profileHelpers.getDefaultWorkspaceId(profile);
    if (!stored) return null;
    const belongs = await actorBelongsToWorkspace(stored, actorId);
    return belongs ? stored : null;
  }

  /** Same filters as the create-form workspace picker. */
  private async resolveFormCreate(actorId: string): Promise<FormCreateCapability> {
    const workspace = await findPermittedWorkspace(actorId, FormCreatePermissions);
    if (!workspace) return 'none';
    return workspace.disclaimerAccepted ? 'allowed' : 'disclaimer_required';
  }

  private async toResponse(
    user: NonNullable<Awaited<ReturnType<typeof findAppUserById>>>,
    idpCode: string | null,
    isSobaAdmin: boolean,
  ): Promise<MeResponse> {
    const view = toAppUserView(user);
    // Independent lookups, run concurrently so /me (a bootstrap hot path) pays
    // one DB round-trip of latency, not one per lookup.
    const [defaultWorkspaceId, canCreateWorkspace, hasWorkspaces, formCreate] = await Promise.all([
      this.resolveDefaultWorkspaceId(view.id, user.profile as StoredProfile),
      canCreateWorkspaceByIdp(idpCode),
      hasActiveMembership(view.id),
      this.resolveFormCreate(view.id),
    ]);
    return {
      actor: {
        id: view.id,
        displayLabel: view.displayLabel,
        status: view.status,
      },
      profile: {
        displayName: view.displayName,
        email: view.email,
        preferredUsername: view.preferredUsername,
      },
      preferences: {
        defaultWorkspaceId,
      },
      capabilities: {
        canCreateWorkspace,
        hasWorkspaces,
        formCreate,
        isSobaAdmin,
      },
    };
  }

  async get(actorId: string, idpCode: string | null, isSobaAdmin: boolean) {
    const user = await findAppUserById(actorId);
    if (!user) return null;
    return this.toResponse(user, idpCode, isSobaAdmin);
  }

  async patch(actorId: string, idpCode: string | null, body: PatchMeBody, isSobaAdmin: boolean) {
    const user = await findAppUserById(actorId);
    if (!user) return null;

    const { preferences } = body;
    if (preferences?.defaultWorkspaceId !== undefined && preferences.defaultWorkspaceId !== null) {
      const belongs = await actorBelongsToWorkspace(preferences.defaultWorkspaceId, actorId);
      if (!belongs) {
        throw new ForbiddenError('Not a member of that workspace');
      }
    }

    const existingProfile = (user.profile as StoredProfile | null) ?? {};
    const existingPreferences =
      existingProfile.preferences && typeof existingProfile.preferences === 'object'
        ? existingProfile.preferences
        : {};

    const nextPreferences = { ...existingPreferences };
    if (preferences?.defaultWorkspaceId !== undefined) {
      nextPreferences.defaultWorkspaceId = preferences.defaultWorkspaceId;
    }

    const nextProfile: StoredProfile = {
      ...existingProfile,
      preferences: nextPreferences,
    };

    const view = toAppUserView(user);
    const updatedBy = view.displayLabel ?? actorId;
    const updated = await updateAppUserProfile(actorId, nextProfile, updatedBy);
    if (!updated) return null;
    return this.toResponse(updated, idpCode, isSobaAdmin);
  }
}

export const meApiService = new MeApiService();
