import { Response } from 'express';
import { asyncHandler } from '../shared/asyncHandler';
import { NotFoundError } from '../../errors';
import { formVersionService, submissionsApiService } from '../../container';
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
 * The schema for a submission's confirmation view. The submission id is the capability: the workspace
 * is resolved from it (openWorkspaceFromResource) and authorized (requireFormAccess), then we read the
 * schema of that submission's own form version — whatever its state, since an older submission may
 * reference a since-archived version. No arbitrary version is reachable by UUID.
 */
export const getSubmitSubmissionSchema = asyncHandler(
  async (req: Request<{ id: string }>, res: Response) => {
    const { schema } = await loadSubmissionSchema(req.coreContext!, req.params.id);
    res.json(schema);
  },
);

/**
 * The one payload the fill page needs for an in-progress submission: its workflow state, its form
 * version schema, and any saved answers. `content` is null for a just-`opened` submission (no engine
 * document yet), so the client renders an empty form without a second, 404-ing data call.
 */
export const getSubmitFillBundle = asyncHandler(
  async (req: Request<{ id: string }>, res: Response) => {
    const ctx = req.coreContext!;
    const { submission, schema } = await loadSubmissionSchema(ctx, req.params.id);
    const content = await submissionsApiService.getData(ctx, req.params.id);
    res.json({ workflowState: submission.workflowState, schema, content: content ?? null });
  },
);
