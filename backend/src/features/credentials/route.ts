import express from 'express';
import { validateRequest } from '../../core/api/shared/validation';
import { workspaceFromResource } from '../../core/middleware/workspaceContext';
import { requireWorkspaceManage } from '../../core/middleware/requireWorkspaceRole';
import {
  getCredential,
  issueCredential,
  regenerateCredential,
  updateCredentialNotes,
} from './controller';
import {
  CredentialParams,
  EmptyCredentialBody,
  WorkspaceCredentialParams,
  CredentialNotesBody,
} from './schema';

export const credentialsRouter = express.Router();
const path = '/workspaces/:id/credentials';
// Apply no-store before validation/auth so secret operations' errors cannot be cached either.
credentialsRouter.use(path, (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
const scope = workspaceFromResource({ kind: 'workspace', idFrom: 'paramsId' });
credentialsRouter.get(
  path,
  validateRequest({ params: WorkspaceCredentialParams }),
  scope,
  requireWorkspaceManage,
  getCredential,
);
credentialsRouter.post(
  path,
  validateRequest({ params: WorkspaceCredentialParams, body: EmptyCredentialBody }),
  scope,
  requireWorkspaceManage,
  issueCredential,
);
credentialsRouter.post(
  `${path}/:credentialId/regenerate`,
  validateRequest({ params: CredentialParams, body: EmptyCredentialBody }),
  scope,
  requireWorkspaceManage,
  regenerateCredential,
);

credentialsRouter.patch(
  `${path}/:credentialId`,
  validateRequest({ params: CredentialParams, body: CredentialNotesBody }),
  scope,
  requireWorkspaceManage,
  updateCredentialNotes,
);
