import { POST_SUBMISSION_EMAIL_PACKAGE_EMAIL_STEP } from '@/src/types/postSubmission';
import { addressListAction } from '../addressList';
import type { PostSubmissionActionUi } from '../types';

/** Emails a list of addresses a link to a package of each new submission. */
export const emailPackageAction: PostSubmissionActionUi = {
  ...addressListAction({
    copy: (dict) => dict.postSubmission.emailPackage,
    testIdPrefix: 'post-submission-email-package',
    notices: (dict, scope) => {
      const t = dict.postSubmission.emailPackage;
      return [
        { key: 'privacy', variant: 'warning', text: t.privacyNotice },
        {
          key: 'template',
          variant: 'info',
          text: scope === 'workspace' ? t.templateNoticeWorkspace : t.templateNoticeForm,
        },
      ];
    },
  }),
  stepLabels: {
    [POST_SUBMISSION_EMAIL_PACKAGE_EMAIL_STEP]: (dict) =>
      dict.postSubmission.emailPackage.emailStep,
  },
};
