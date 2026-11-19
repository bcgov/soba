import { DEFAULT_EMAIL_LANGUAGE } from '../../core/integrations/notification/email/language';
import type { RenderedEmail } from '../../core/integrations/notification/email/layout';
import {
  defineSubmissionEmail,
  renderSubmissionEmail,
} from '../../core/integrations/notification/email/submissionEmail';
import { formsMySubmissionsUrl, formsSubmissionUrl } from '../../core/appLinks';

export const EMAIL_COPY = defineSubmissionEmail({
  en: {
    subject: ({ form }) => `${form} submitted`,
    title: ({ form }) => `${form} submitted`,
    sentence: ({ form }) =>
      `Thank you for your ${form} submission. You can view your submission details by visiting the following links:`,
    linkText: 'View this submission',
    secondLinkText: 'View your past submissions (sign in required)',
  },
  fr: {
    subject: ({ form }) => `${form} soumis`,
    title: ({ form }) => `${form} soumis`,
    sentence: ({ form }) =>
      `Merci pour votre soumission pour ${form}. Vous pouvez consulter les détails de votre soumission en visitant les liens suivants :`,
    linkText: 'Voir cette soumission',
    secondLinkText: 'Voir vos soumissions antérieures (connexion requise)',
  },
});

/** What the copy says about the submission. Nothing the submitter typed is in it. */
export interface EmailCopyFacts {
  submissionId: string;
  formName: string;
  confirmationCode: string;
  /** False for the public user, whose submissions anyone with the link can open. */
  signedIn: boolean;
  /** The form's audience is public. */
  publicForm: boolean;
}

/**
 * The copy, in each language: the Confirmation ID and the form. A signed-in requester also gets a
 * link to the submission, which needs their sign-in, and, on a form that is not public, a link to
 * their past submissions. Never its answers.
 */
export const buildEmailCopy = (
  facts: EmailCopyFacts,
  formsAppUrl: string | undefined,
): RenderedEmail =>
  renderSubmissionEmail(
    EMAIL_COPY,
    {
      formName: facts.formName,
      confirmationCode: facts.confirmationCode,
      link: (language) =>
        facts.signedIn
          ? formsSubmissionUrl(formsAppUrl, language, 'submission', facts.submissionId)
          : null,
      secondLink:
        facts.signedIn && !facts.publicForm
          ? (language) => formsMySubmissionsUrl(formsAppUrl, language)
          : undefined,
    },
    DEFAULT_EMAIL_LANGUAGE,
  );
