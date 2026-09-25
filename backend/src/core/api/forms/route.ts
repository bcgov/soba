import express from 'express';
import { validateRequest } from '../shared/validation';
import { SortLocaleQuerySchema } from '../shared/offsetPagination';
import { sortLocale } from '../../middleware/sortLocale';
import {
  workspaceFromBody,
  workspaceListScope,
  workspaceFromResource,
} from '../../middleware/workspaceContext';
import { requireFormPermissions } from '../../middleware/requireFormPermissions';
import { FormCreatePermissions, Permissions } from '../../db/codes';
import {
  createForm,
  normalizeFormSchema,
  createFormVersion,
  updateForm,
  getForm,
  getFormVersion,
  listForms,
  listFormVersions,
  lookupFormVersions,
  deleteForm,
  deleteFormVersion,
  saveFormVersion,
  publishFormVersion,
  unpublishFormVersion,
  restoreFormVersion,
  provisionFormVersionSchema,
  getFormVersionSchema,
  getFormSubmitterAudience,
  setFormSubmitterAudience,
} from './controller';
import {
  CreateFormBodySchema,
  CreateFormVersionBodySchema,
  FormIdParamsSchema,
  FormVersionIdParamsSchema,
  NormalizeSchemaBodySchema,
  ListFormsQuerySchema,
  ListFormVersionsQuerySchema,
  FormVersionLookupQuerySchema,
  ProvisionSchemaBodySchema,
  SaveFormVersionBodySchema,
  SaveFormVersionParamsSchema,
  SetFormSubmitterAudienceBodySchema,
  UpdateFormBodySchema,
} from './schema';

// Design-mode form authoring: mounted under /api/v1/design with mandatory auth. Every route is
// staff-only — membership is resolved strictly and gated by form permissions (no audience logic;
// that lives in the submit feature).
const router = express.Router();

const FORMS_PATH = '/forms';
const FORMS_ID_PATH = `${FORMS_PATH}/:id`;
const FORM_SUBMITTER_AUDIENCE_PATH = `${FORMS_ID_PATH}/submitter-audience`;
const FORM_VERSIONS_PATH = '/form-versions';
const FORM_VERSIONS_ID_PATH = `${FORM_VERSIONS_PATH}/:id`;

const formResource = workspaceFromResource({ kind: 'form', idFrom: 'paramsId' });
const formVersionResource = workspaceFromResource({ kind: 'formVersion', idFrom: 'paramsId' });
// Creating a version resolves the workspace from the parent form id in the request body.
const formFromBodyResource = workspaceFromResource({ kind: 'form', idFrom: 'bodyFormId' });

router.get(
  FORMS_PATH,
  validateRequest({ query: ListFormsQuerySchema }),
  sortLocale,
  workspaceListScope({ anchorOrder: ['formId', 'workspaceId'], allowEmpty: true }),
  requireFormPermissions([Permissions.form_read]),
  listForms,
);
// Workspace from the body; disclaimer is checked in the service. form_create is form_admin-only (`*`).
router.post(
  FORMS_PATH,
  validateRequest({ body: CreateFormBodySchema }),
  workspaceFromBody,
  requireFormPermissions(FormCreatePermissions),
  createForm,
);
// Schema-shaping utility; actor-only (no workspace context).
router.post(
  `${FORMS_PATH}/normalize`,
  validateRequest({ body: NormalizeSchemaBodySchema }),
  normalizeFormSchema,
);
router.get(
  FORMS_ID_PATH,
  validateRequest({ params: FormIdParamsSchema }),
  formResource,
  requireFormPermissions([Permissions.form_read]),
  getForm,
);
router.patch(
  FORMS_ID_PATH,
  validateRequest({ params: FormIdParamsSchema, body: UpdateFormBodySchema }),
  formResource,
  requireFormPermissions([Permissions.form_update]),
  updateForm,
);
router.get(
  FORM_SUBMITTER_AUDIENCE_PATH,
  validateRequest({ query: SortLocaleQuerySchema, params: FormIdParamsSchema }),
  sortLocale,
  formResource,
  requireFormPermissions([Permissions.form_read]),
  getFormSubmitterAudience,
);
router.put(
  FORM_SUBMITTER_AUDIENCE_PATH,
  validateRequest({
    query: SortLocaleQuerySchema,
    params: FormIdParamsSchema,
    body: SetFormSubmitterAudienceBodySchema,
  }),
  sortLocale,
  formResource,
  requireFormPermissions([Permissions.form_update]),
  setFormSubmitterAudience,
);
router.get(
  FORM_VERSIONS_PATH,
  validateRequest({ query: ListFormVersionsQuerySchema }),
  workspaceListScope({ anchorOrder: ['formVersionId', 'formId', 'workspaceId'], allowEmpty: true }),
  requireFormPermissions([Permissions.form_read]),
  listFormVersions,
);
// Registered before the `:id` route, which would otherwise take `lookup` as an id.
router.get(
  `${FORM_VERSIONS_PATH}/lookup`,
  validateRequest({ query: FormVersionLookupQuerySchema }),
  workspaceListScope({ anchorOrder: ['formId'] }),
  requireFormPermissions([Permissions.form_read]),
  lookupFormVersions,
);
router.get(
  FORM_VERSIONS_ID_PATH,
  validateRequest({ params: FormVersionIdParamsSchema }),
  formVersionResource,
  requireFormPermissions([Permissions.form_read]),
  getFormVersion,
);
router.post(
  FORM_VERSIONS_PATH,
  validateRequest({ body: CreateFormVersionBodySchema }),
  formFromBodyResource,
  requireFormPermissions([Permissions.design_create]),
  createFormVersion,
);
router.post(
  `${FORM_VERSIONS_ID_PATH}/save`,
  validateRequest({ params: SaveFormVersionParamsSchema, body: SaveFormVersionBodySchema }),
  formVersionResource,
  requireFormPermissions([Permissions.design_update]),
  saveFormVersion,
);
router.post(
  `${FORM_VERSIONS_ID_PATH}/publish`,
  validateRequest({ params: FormVersionIdParamsSchema }),
  formVersionResource,
  requireFormPermissions([Permissions.design_update]),
  publishFormVersion,
);
router.post(
  `${FORM_VERSIONS_ID_PATH}/unpublish`,
  validateRequest({ params: FormVersionIdParamsSchema }),
  formVersionResource,
  requireFormPermissions([Permissions.design_update]),
  unpublishFormVersion,
);
router.post(
  `${FORM_VERSIONS_ID_PATH}/restore`,
  validateRequest({ params: FormVersionIdParamsSchema }),
  formVersionResource,
  requireFormPermissions([Permissions.design_update]),
  restoreFormVersion,
);
router.get(
  `${FORM_VERSIONS_ID_PATH}/schema`,
  validateRequest({ params: FormVersionIdParamsSchema }),
  formVersionResource,
  requireFormPermissions([Permissions.form_read]),
  getFormVersionSchema,
);
router.post(
  `${FORM_VERSIONS_ID_PATH}/schema`,
  validateRequest({ params: FormVersionIdParamsSchema, body: ProvisionSchemaBodySchema }),
  formVersionResource,
  requireFormPermissions([Permissions.design_update]),
  provisionFormVersionSchema,
);
router.delete(
  FORM_VERSIONS_ID_PATH,
  validateRequest({ params: FormVersionIdParamsSchema }),
  formVersionResource,
  requireFormPermissions([Permissions.design_delete]),
  deleteFormVersion,
);
router.delete(
  FORMS_ID_PATH,
  validateRequest({ params: FormIdParamsSchema }),
  formResource,
  requireFormPermissions([Permissions.form_delete]),
  deleteForm,
);

export { router as designFormsRouter };
