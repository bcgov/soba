import express from 'express';
import type { z, ZodTypeAny } from 'zod';
import { validateRequest } from '../../core/api/shared/validation';
import { asyncHandler } from '../../core/api/shared/asyncHandler';
import { requireFormPermissions } from '../../core/middleware/requireFormPermissions';
import { Permissions } from '../../core/db/codes';
import type { CoreRequestContext } from '../../core/middleware/requestContext';

/** What a settings service reads from the request: the form's workspace and the actor's label. */
export type FormSettingsContext = Pick<CoreRequestContext, 'workspaceId' | 'actorDisplayLabel'>;

/** Reads and writes one settings group of a form. */
export interface FormSettingsService<TSettings, TBody> {
  get(ctx: FormSettingsContext, formId: string): Promise<TSettings>;
  set(ctx: FormSettingsContext, formId: string, body: TBody): Promise<TSettings>;
}

/**
 * The standard routes of a settings group: GET needs form_read; PUT needs form_update and a body
 * matching `bodySchema`. The shared settings router has already resolved the form.
 */
export const settingsRoutes = <TSettings, TSchema extends ZodTypeAny>(
  service: FormSettingsService<TSettings, z.infer<TSchema>>,
  bodySchema: TSchema,
): express.Router => {
  const router = express.Router({ mergeParams: true });
  router.get(
    '/',
    requireFormPermissions([Permissions.form_read]),
    asyncHandler(async (req, res) => {
      res.json(await service.get(req.coreContext!, req.params.id));
    }),
  );
  router.put(
    '/',
    validateRequest({ body: bodySchema }),
    requireFormPermissions([Permissions.form_update]),
    asyncHandler(async (req, res) => {
      res.json(await service.set(req.coreContext!, req.params.id, req.body as z.infer<TSchema>));
    }),
  );
  return router;
};
