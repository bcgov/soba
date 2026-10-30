import express from 'express';
import { sortLocale } from '../../core/middleware/sortLocale';
import { Permissions } from '../../core/db/codes';
import { requireFormPermissions } from '../../core/middleware/requireFormPermissions';
import { validateRequest } from '../../core/api/shared/validation';
import { workspaceFromResource } from '../../core/middleware/workspaceContext';
import { requireWorkspaceManage } from '../../core/middleware/requireWorkspaceRole';
import {
  listCredentials,
  listFormCredentials,
  issueFormCredential,
  issueCredential,
  regenerateCredential,
  updateCredentialNotes,
} from './controller';
import {
  CredentialParams,
  ListCredentialsQuerySchema,
  CreateCredentialSchema,
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
  validateRequest({ params: WorkspaceCredentialParams, query: ListCredentialsQuerySchema }),
  sortLocale,
  scope,
  requireWorkspaceManage,
  listCredentials,
);
credentialsRouter.post(
  path,
  validateRequest({ params: WorkspaceCredentialParams }),
  scope,
  requireWorkspaceManage,
  validateRequest({ body: CreateCredentialSchema }),
  issueCredential,
);
credentialsRouter.post(
  `${path}/:credentialId/regenerate`,
  validateRequest({ params: CredentialParams }),
  scope,
  requireWorkspaceManage,
  validateRequest({ body: EmptyCredentialBody }),
  regenerateCredential,
);

credentialsRouter.patch(
  `${path}/:credentialId`,
  validateRequest({ params: CredentialParams }),
  scope,
  requireWorkspaceManage,
  validateRequest({ body: CredentialNotesBody }),
  updateCredentialNotes,
);

/** Mounted on the design surface, whose authentication/feature gates run first. */
export const formCredentialsRouter = express.Router();
const formPath = '/forms/:id/credentials';
const formScope = workspaceFromResource({ kind: 'form', idFrom: 'paramsId' });
// Issuing credentials grants machine access, so reads and creation both require form management.
const manageForm = requireFormPermissions([Permissions.form_update]);
formCredentialsRouter.use(formPath, (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
formCredentialsRouter.get(
  formPath,
  validateRequest({ params: WorkspaceCredentialParams, query: ListCredentialsQuerySchema }),
  sortLocale,
  formScope,
  manageForm,
  listFormCredentials,
);
formCredentialsRouter.post(
  formPath,
  validateRequest({ params: WorkspaceCredentialParams }),
  formScope,
  manageForm,
  validateRequest({ body: CreateCredentialSchema }),
  issueFormCredential,
);
