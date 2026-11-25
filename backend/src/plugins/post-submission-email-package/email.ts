import { designerSubmissionPackageUrl } from '../../core/appLinks';
import {
  DEFAULT_EMAIL_LANGUAGE,
  type EmailLanguage,
} from '../../core/integrations/notification/email/language';
import type { RenderedEmail } from '../../core/integrations/notification/email/layout';
import {
  defineSubmissionEmail,
  renderSubmissionEmail,
  type SubmissionEmailTemplate,
} from '../../core/integrations/notification/email/submissionEmail';
import type { PostSubmissionActionSubmission } from '../../core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';

const ZONE = 'America/Vancouver';

const ENGLISH_DATE = new Intl.DateTimeFormat('en-CA', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: ZONE,
});

const FRENCH_PARTS = new Intl.DateTimeFormat('fr-CA', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: ZONE,
});

/** The date and time in French: the first of a month as "1er", the hour without a leading zero. */
const frenchDate = (at: Date): string => {
  const parts = Object.fromEntries(
    FRENCH_PARTS.formatToParts(at).map((part) => [part.type, part.value]),
  );
  const day = parts.day === '1' ? '1er' : parts.day;
  return `${day} ${parts.month} ${parts.year} à ${parts.hour} h ${parts.minute}`;
};

const EXPIRY: Readonly<Record<EmailLanguage, (at: Date) => string>> = {
  en: (at) => `${ENGLISH_DATE.format(at)} Pacific time`,
  fr: (at) => `${frenchDate(at)} (heure du Pacifique)`,
};

/** When the link stops working, in Pacific time, in a language. */
export const expiryText = (expiresAt: Date, language: EmailLanguage): string =>
  EXPIRY[language](expiresAt);

/**
 * The package email's words. The template is made for each email because its words carry the time
 * the link stops working.
 */
export const packageEmailTemplate = (expiresAt: Date): SubmissionEmailTemplate =>
  defineSubmissionEmail({
    en: {
      subject: ({ form }) => `${form} Submission Package`,
      sentence: ({ form }) =>
        `A package of this ${form} submission is ready: a PDF of the answers and the files uploaded with it. Any uploaded file that could not be included is listed in the package. Please sign in to download it. The link works until ${expiryText(expiresAt, 'en')}.`,
      linkText: 'Download the submission package',
    },
    fr: {
      subject: ({ form }) => `Paquet de soumission : ${form}`,
      sentence: ({ form }) =>
        `Un paquet de cette soumission pour ${form} est prêt : un PDF des réponses et les fichiers téléversés avec elle. Tout fichier téléversé qui n’a pu être inclus est indiqué dans le paquet. Veuillez vous connecter pour le télécharger. Le lien fonctionne jusqu’au ${expiryText(expiresAt, 'fr')}.`,
      linkText: 'Télécharger le paquet de la soumission',
    },
  });

/**
 * The email for a package built by the job `jobId`: in each language, a link to the package page in
 * the designer, which needs sign-in and access to the submission.
 */
export const buildPackageEmail = (
  submission: PostSubmissionActionSubmission,
  jobId: string,
  expiresAt: Date,
  designerAppUrl: string,
): RenderedEmail =>
  renderSubmissionEmail(
    packageEmailTemplate(expiresAt),
    {
      formName: submission.formName,
      confirmationCode: submission.confirmationCode,
      link: (language) =>
        designerSubmissionPackageUrl(
          designerAppUrl,
          language,
          submission.formId,
          submission.id,
          jobId,
        ),
    },
    DEFAULT_EMAIL_LANGUAGE,
  );
