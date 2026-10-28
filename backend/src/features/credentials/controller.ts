import { asyncHandler } from '../../core/api/shared/asyncHandler';
import { workspaceCredentialService } from './service';

export const getCredential = asyncHandler(async (req, res) => {
  res.json(await workspaceCredentialService.get(req.coreContext!.workspaceId));
});
export const issueCredential = asyncHandler(async (req, res) => {
  const { workspaceId, actorId } = req.coreContext!;
  res.status(201).json(await workspaceCredentialService.issue(workspaceId, actorId));
});
export const regenerateCredential = asyncHandler(async (req, res) => {
  const { workspaceId, actorId } = req.coreContext!;
  res.json(
    await workspaceCredentialService.regenerate(workspaceId, req.params.credentialId, actorId),
  );
});

export const updateCredentialNotes = asyncHandler(async (req, res) => {
  const { workspaceId, actorId } = req.coreContext!;
  res.json(
    await workspaceCredentialService.updateNotes(
      workspaceId,
      req.params.credentialId,
      actorId,
      req.body.notes,
    ),
  );
});
