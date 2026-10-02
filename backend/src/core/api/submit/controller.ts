import { Response } from 'express';
import { z } from 'zod';
import type { SubmitFillBundle } from '@soba/lib';
import { asyncHandler } from '../shared/asyncHandler';
import { NotFoundError } from '../../errors';
import { formVersionService, submissionsApiService } from '../../container';
import { resolveCaller } from '../../middleware/actor';
import { isSubmitterAllowed, SubmitterOperation } from '../../services/submitterAccess';
import { log } from '../../logging';
import { DraftSaveStatus, getDraftSaveStatus } from '../../../features/form-settings/submitter';
import type { Request } from 'express';
import { ListMySubmissionsQuerySchema } from './schema';

type SubmitContext = NonNullable<Request['coreContext']>;
type ListMySubmissionsQuery = z.infer<typeof ListMySubmissionsQuerySchema>;

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

/** Whether the fill page offers a draft save; a failed lookup offers none, so the form still opens. */
const offersDraftSave = async (ctx: SubmitContext, formId: string): Promise<boolean> => {
  try {
    return (await getDraftSaveStatus(ctx, formId)) === DraftSaveStatus.allowed;
  } catch (err) {
    log.error({ err, formId }, 'Draft save status lookup failed');
    return false;
  }
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
 * caller may write and save a draft. `content` is null for a just-`opened` submission (no engine
 * document yet), so the client renders an empty form without a second, 404-ing data call.
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
    const canSaveDraft = canWrite && (await offersDraftSave(ctx, submission.formId));
    const bundle: SubmitFillBundle = {
      workflowState: submission.workflowState,
      formVersionId: submission.formVersionId,
      headRevisionId: submission.headRevisionId,
      schema,
      content: content ?? null,
      canWrite,
      canSaveDraft,
    };
    res.json(bundle);
  },
);

/** The caller's own draft and submitted submissions. Runs after requireSignedInSubmitter. */
export const listMySubmissions = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListMySubmissionsQuery;
  res.json(
    await submissionsApiService.listMine(req.actorId!, {
      offset: query.offset,
      limit: query.limit,
      workflowState: query.workflowState,
      q: query.q,
      sort: query.sort,
      locale: req.sortLocale!,
    }),
  );
});
