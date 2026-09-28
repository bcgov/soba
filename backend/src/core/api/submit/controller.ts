import { Response } from 'express';
import type { SubmitFillBundle } from '@soba/lib';
import { asyncHandler } from '../shared/asyncHandler';
import { NotFoundError } from '../../errors';
import { formVersionService, submissionsApiService } from '../../container';
import { resolveCaller } from '../../middleware/actor';
import { isSubmitterAllowed, SubmitterOperation } from '../../services/submitterAccess';
import type { Request } from 'express';

type SubmitContext = NonNullable<Request['coreContext']>;

/** Load a submission and its form-version schema by id (both required), or throw 404. */
const loadSubmissionSchema = async (ctx: SubmitContext, submissionId: string) => {
  const submission = await submissionsApiService.get(ctx, submissionId);
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
  return { submission, schema };
};

/**
 * The schema for a submission's confirmation view: the schema of that submission's own form version,
 * whatever its state, since an older submission may reference a since-archived version. No arbitrary
 * version is reachable by UUID.
 */
export const getSubmitSubmissionSchema = asyncHandler(
  async (req: Request<{ id: string }>, res: Response) => {
    const { schema } = await loadSubmissionSchema(req.coreContext!, req.params.id);
    res.json(schema);
  },
);

/**
 * The one payload the fill page needs for an in-progress submission: its workflow state, form
 * version and schema, head revision (the base for the next write), any saved answers, and whether the
 * caller may write. `content` is null for a just-`opened` submission (no engine document yet), so the
 * client renders an empty form without a second, 404-ing data call.
 */
export const getSubmitFillBundle = asyncHandler(
  async (req: Request<{ id: string }>, res: Response) => {
    const ctx = req.coreContext!;
    const { submission, schema } = await loadSubmissionSchema(ctx, req.params.id);
    const [content, canWrite] = await Promise.all([
      submissionsApiService.getData(ctx, req.params.id),
      isSubmitterAllowed(
        SubmitterOperation.write,
        { workspaceId: ctx.workspaceId, formId: submission.formId, submissionId: req.params.id },
        resolveCaller(req),
      ),
    ]);
    const bundle: SubmitFillBundle = {
      workflowState: submission.workflowState,
      formVersionId: submission.formVersionId,
      headRevisionId: submission.headRevisionId,
      schema,
      content: content ?? null,
      canWrite,
    };
    res.json(bundle);
  },
);
