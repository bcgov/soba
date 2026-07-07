import { Response } from 'express';
import { asyncHandler } from '../shared/asyncHandler';
import { NotFoundError } from '../../errors';
import { getPublishedVersionForForm } from '../../db/repos/formVersionRepo';
import { formService, formVersionService, submissionsApiService } from '../../container';
import type { Request } from 'express';

const FORM_NOT_FOUND = 'Form not found';

/**
 * Submit-mode form bundle: the form, its currently published version, and that version's schema — the
 * one payload the public fill page needs. The workspace is already resolved (openWorkspaceFromResource)
 * and authorized (requireFormAccess) against the Form submitters audience; only the published version
 * is ever returned, so drafts never reach the public.
 */
export const getSubmitForm = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const { workspaceId } = req.coreContext!;
  const formId = req.params.id;

  const published = await getPublishedVersionForForm(workspaceId, formId);
  if (!published) {
    throw new NotFoundError('Form has no published version');
  }

  const [form, schema] = await Promise.all([
    formService.get(workspaceId, formId),
    formVersionService.getSchemaForVersion(published),
  ]);
  if (!form) {
    throw new NotFoundError(FORM_NOT_FOUND);
  }

  res.json({
    form: { id: form.id, name: form.name, description: form.description },
    publishedVersion: {
      id: published.id,
      formId: published.formId,
      versionNo: published.versionNo,
      state: published.state,
      publishedAt: published.publishedAt?.toISOString() ?? null,
    },
    schema: schema ?? null,
  });
});

/**
 * The schema for a submission's confirmation view. The submission id is the capability: the workspace
 * is resolved from it (openWorkspaceFromResource) and authorized (requireFormAccess), then we read the
 * schema of that submission's own form version — whatever its state, since an older submission may
 * reference a since-archived version. No arbitrary version is reachable by UUID.
 */
export const getSubmitSubmissionSchema = asyncHandler(
  async (req: Request<{ id: string }>, res: Response) => {
    const ctx = req.coreContext!;
    const submission = await submissionsApiService.get(ctx, req.params.id);
    if (!submission) {
      throw new NotFoundError('Submission not found');
    }

    const schema = await formVersionService.getSchema({
      workspaceId: ctx.workspaceId,
      formVersionId: submission.formVersionId,
    });
    if (!schema) {
      throw new NotFoundError('Form version schema not found');
    }
    res.json(schema);
  },
);
