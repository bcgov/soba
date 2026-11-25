import { designerSubmissionPackageUrl } from '../../../src/core/appLinks';
import { renderSubmissionEmail } from '../../../src/core/integrations/notification/email/submissionEmail';
import {
  buildPackageEmail,
  expiryText,
  packageEmailTemplate,
} from '../../../src/plugins/post-submission-email-package/email';

const DESIGNER = 'https://soba.example/designer';
// 10:28 a.m. in Vancouver. A summer time, so older and newer time zone data agree on the offset.
const EXPIRES = new Date('2026-07-15T17:28:22Z');

const submission = {
  id: 's1',
  formId: 'f1',
  formVersionId: 'v1',
  formName: 'Permit application',
  workspaceId: 'w1',
  workspaceName: 'Licensing',
  confirmationCode: 'ABCD1234',
};

const link = (language: 'en' | 'fr') =>
  `https://soba.example/designer/${language}/build/f1/submissions/s1/packages/job-1`;

describe('the package email', () => {
  it('says what the package holds, that it needs sign-in, until when the link works, and links to it', () => {
    const email = renderSubmissionEmail(
      packageEmailTemplate(EXPIRES),
      {
        formName: submission.formName,
        confirmationCode: submission.confirmationCode,
        link: (language) => designerSubmissionPackageUrl(DESIGNER, language, 'f1', 's1', 'job-1'),
      },
      'en',
    );
    expect(email).toEqual({
      subject: 'Permit application Submission Package (ABCD1234)',
      body: [
        '<div style="max-width:600px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:#2d2d2d;">',
        '<div lang="en">',
        '<p style="margin:0 0 16px 0;">Confirmation ID: <strong>ABCD1234</strong></p>',
        '<p style="margin:0 0 16px 0;">A package of this Permit application submission is ready: a PDF of the answers and the files uploaded with it. Any uploaded file that could not be included is listed in the package. Please sign in to download it. The link works until July 15, 2026 at 10:28 a.m. Pacific time.</p>',
        `<p style="margin:0 0 16px 0;"><a href="${link('en')}" style="color:#255a90;text-decoration:underline;">Download the submission package</a></p>`,
        '</div>',
        '<p style="margin:0;font-size:14px;line-height:20px;color:#474543;"><span lang="en">This is an automated message from CHEFS. Please do not reply.</span></p>',
        '</div>',
      ].join('\n'),
      bodyType: 'html',
    });
  });

  it('goes out in both languages, each linking to the package page in its own language', () => {
    const { subject, body } = buildPackageEmail(submission, 'job-1', EXPIRES, DESIGNER);

    expect(subject).toBe(
      'Permit application Submission Package / Paquet de soumission : Permit application (ABCD1234)',
    );
    expect(body).toContain(
      'Un paquet de cette soumission pour Permit application est prêt : un PDF des réponses et les fichiers téléversés avec elle. Tout fichier téléversé qui n’a pu être inclus est indiqué dans le paquet. Veuillez vous connecter pour le télécharger. Le lien fonctionne jusqu’au 15 juillet 2026 à 10 h 28 (heure du Pacifique).',
    );
    expect(body).toContain(`href="${link('en')}"`);
    expect(body).toContain(`href="${link('fr')}"`);
    expect(body).toContain('>Télécharger le paquet de la soumission</a>');
  });
});

describe('expiryText', () => {
  it('writes the first of a month as 1er in French, and the hour without a leading zero', () => {
    // 2:05 a.m. on July 1 in Vancouver.
    const at = new Date('2026-07-01T09:05:00Z');
    expect(expiryText(at, 'fr')).toBe('1er juillet 2026 à 2 h 05 (heure du Pacifique)');
  });
});
