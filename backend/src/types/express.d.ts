import type { NormalizedProfile, IdpAttributes } from '../core/auth/jwtClaims';
import type { SortLocale } from '@soba/lib';
import type { CoreRequestContext, CoreListScope } from '../core/middleware/requestContext';
import type { SubmitterSubmission } from '../core/db/repos/submitterSubmissionRepo';
import type {
  SubmitterFormListRow,
  SubmitterFormVersionRow,
} from '../core/db/repos/submitterFormRepo';
import type { PreparedUploadPrint } from '../features/document-generation/service';

declare global {
  namespace Express {
    interface User {
      pluginCode: string;
      authPayload: Record<string, unknown>;
      subject: string;
      providerCode: string;
      profile: NormalizedProfile;
      idpAttributes: IdpAttributes;
      sobaAdmin?: boolean;
    }

    interface Request {
      decodedJwt?: Record<string, unknown>;
      authPayload?: Record<string, unknown>;
      bceidType?: 'bceidbasic' | 'bceidbusiness';
      idpType?: string;
      idpPluginCode?: string;
      coreContext?: CoreRequestContext;
      listScope?: CoreListScope;
      /** The submission a submit route acts on, read once by loadSubmitterSubmission. */
      submitterSubmission?: SubmitterSubmission;
      /** The form a submit route acts on, read once by its form or form version load. */
      submitterForm?: SubmitterFormListRow;
      /** The form version a submit route reads, read once by loadSubmitterFormVersion. */
      submitterFormVersion?: SubmitterFormVersionRow;
      /** The staff upload print preparePrintUploadHandler checked before the body was read. */
      printUpload?: PreparedUploadPrint;
      sortLocale?: SortLocale;
      actorId?: string;
      isSobaAdmin?: boolean;
    }
  }
}

export {};
