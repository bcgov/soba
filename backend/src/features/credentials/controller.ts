import type { CreateCredential } from '@soba/lib';
import type { CredentialListQuery, CredentialNotesInput } from './schema';
import { asyncHandler } from '../../core/api/shared/asyncHandler';
import { credentialService } from './service';

export const listCredentials = asyncHandler(async (req, res) => {
  res.json(
    await credentialService.list(req.coreContext!.workspaceId, {
      ...req.query,
      locale: req.sortLocale,
    } as CredentialListQuery),
  );
});
export const issueCredential = asyncHandler(async (req, res) => {
  const { workspaceId, actorId } = req.coreContext!;
  const body = req.body as CreateCredential;
  res.status(201).json(await credentialService.issue(workspaceId, actorId, body));
});
export const regenerateCredential = asyncHandler(async (req, res) => {
  const { workspaceId, actorId } = req.coreContext!;
  res.json(await credentialService.regenerate(workspaceId, req.params.credentialId, actorId));
});

export const updateCredentialNotes = asyncHandler(async (req, res) => {
  const body = req.body as CredentialNotesInput;
  const { workspaceId, actorId } = req.coreContext!;
  res.json(
    await credentialService.updateNotes(workspaceId, req.params.credentialId, actorId, body.notes),
  );
});

export const listFormCredentials = asyncHandler(async (req, res) => {
  const { workspaceId } = req.coreContext!;
  res.json(
    await credentialService.list(
      workspaceId,
      { ...req.query, locale: req.sortLocale } as CredentialListQuery,
      req.params.id,
    ),
  );
});
export const issueFormCredential = asyncHandler(async (req, res) => {
  const { workspaceId, actorId } = req.coreContext!;
  const body = req.body as CreateCredential;
  res.status(201).json(await credentialService.issue(workspaceId, actorId, body, req.params.id));
});
