import type { PostSubmissionActionSubmission } from '../../core/integrations/post-submission-action/PostSubmissionActionPluginDefinition';

const MAX_NAME_LENGTH = 200;

// A scheme and "://", or "www.", up to the next space: text a mail client would make a link of.
const LINK = /\b(?:[a-z][a-z\d+.-]*:\/\/|www\.)\S*/giu;

/**
 * A name fit for an email: no control or format characters, no links (only the designer link is
 * the notice's own), one line, at most 200 characters.
 */
export const cleanName = (value: string): string =>
  Array.from(
    value
      .replaceAll(/[\p{Cc}\p{Cf}]+/gu, ' ')
      .replaceAll(LINK, '[link removed]')
      .replaceAll(/\s+/g, ' ')
      .trim(),
  )
    .slice(0, MAX_NAME_LENGTH)
    .join('')
    .trimEnd();

const withoutTrailingSlashes = (url: string): string => {
  let end = url.length;
  while (end > 0 && url[end - 1] === '/') end -= 1;
  return url.slice(0, end);
};

/** The submission in the designer; opening it needs sign-in and access to the submission. */
export const designerLink = (
  designerAppUrl: string | undefined,
  submission: PostSubmissionActionSubmission,
): string | null =>
  designerAppUrl
    ? `${withoutTrailingSlashes(designerAppUrl)}/en/build/${submission.formId}/submissions/${submission.id}`
    : null;

export interface Notice {
  subject: string;
  body: string;
}

/** The fixed notice: the form, the confirmation ID, the link and who set it up. */
export const buildNotice = (
  submission: PostSubmissionActionSubmission,
  link: string | null,
): Notice => {
  const formName = cleanName(submission.formName);
  const workspaceName = cleanName(submission.workspaceName);
  const lines = [
    `A submission to "${formName}" was received.`,
    '',
    `Confirmation ID: ${submission.confirmationCode}`,
    ...(link ? ['', `View it (sign-in required): ${link}`] : []),
    '',
    `You are receiving this because the team for this form in the "${workspaceName}" workspace set up this notice.`,
  ];
  return { subject: `Submission received: ${formName}`, body: lines.join('\n') };
};
