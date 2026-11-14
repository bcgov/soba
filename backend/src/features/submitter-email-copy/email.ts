import { DEFAULT_EMAIL_LANGUAGE } from '../../core/integrations/notification/email/language';
import type { RenderedEmail } from '../../core/integrations/notification/email/layout';
import {
  defineSubmissionEmail,
  renderSubmissionEmail,
} from '../../core/integrations/notification/email/submissionEmail';
import { formsMySubmissionsUrl, formsSubmissionUrl } from '../../core/appLinks';

export const EMAIL_COPY = defineSubmissionEmail({
  en: {
    subject: ({ form }) => `Your submission to ${form} was submitted`,
    sentence: ({ form }) =>
      `Thank you for your ${form} submission. You asked for this copy on the confirmation screen.`,
    linkText: 'View this submission',
    secondLinkText: 'View your past submissions (sign in required)',
  },
  fr: {
    subject: ({ form }) => `Votre soumission à ${form} a été soumise`,
    sentence: ({ form }) =>
      `Merci pour votre soumission pour ${form}. Vous avez demandé cette copie à partir de l’écran de confirmation.`,
    linkText: 'Voir cette soumission',
    secondLinkText: 'Voir vos soumissions antérieures (connexion requise)',
  },
});

/** What the copy says about the submission. Nothing the submitter typed is in it. */
export interface EmailCopyFacts {
  submissionId: string;
  formName: string;
  confirmationCode: string;
  /** Only a signed-in submitter has submissions of their own to list. */
  signedIn: boolean;
}

/**
 * The copy, in each language: the Confirmation ID, the form, a link to the submission in the forms
 * app and, for a signed-in submitter, a link to their past submissions. Never its answers.
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
        formsSubmissionUrl(formsAppUrl, language, 'submission', facts.submissionId),
      secondLink: facts.signedIn
        ? (language) => formsMySubmissionsUrl(formsAppUrl, language)
        : undefined,
    },
    DEFAULT_EMAIL_LANGUAGE,
  );
