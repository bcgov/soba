import { buildEmailCopy, EMAIL_COPY } from '../../../src/features/submitter-email-copy/email';

const facts = {
  submissionId: 's1',
  formName: 'Permit application',
  confirmationCode: 'K7M2Q9XA',
  signedIn: true,
  publicForm: false,
};
const FORMS = 'https://forms.example';

describe('buildEmailCopy', () => {
  it('writes one email in both languages, the subject ending with the Confirmation ID', () => {
    const { subject, body, bodyType } = buildEmailCopy(facts, FORMS);
    expect(bodyType).toBe('html');
    expect(subject).toBe(
      'Permit application submitted / Formulaire soumis : Permit application (K7M2Q9XA)',
    );
    expect(body).toContain('>Permit application submitted</h1>');
    expect(body).toContain('>Formulaire soumis : Permit application</h1>');
    expect(body).toContain('Confirmation ID: <strong>K7M2Q9XA</strong>');
    expect(body).toContain('ID de confirmation : <strong>K7M2Q9XA</strong>');
    expect(body).toContain('>Thank you for your Permit application submission.</p>');
    expect(body).toContain(
      '>You can view your submission details by visiting the following links:</p>',
    );
    expect(body).toContain('>Merci pour votre soumission pour Permit application.</p>');
    expect(body).toContain(
      '>Vous pouvez consulter les détails de votre soumission en visitant les liens suivants :</p>',
    );
  });

  // Each language links under its own path; the URL itself is not printed.
  it('links the submission and, for a signed-in submitter, their past submissions', () => {
    const { body } = buildEmailCopy(facts, FORMS);
    for (const language of ['en', 'fr']) {
      expect(body).toContain(`href="${FORMS}/${language}/submission/s1"`);
      expect(body).toContain(`href="${FORMS}/${language}/my-submissions"`);
    }
    expect(body).toContain('>View your past submissions (sign in required)</a>');
    expect(body).toContain('>Voir vos soumissions antérieures (connexion requise)</a>');
    expect(body).not.toContain(`>${FORMS}`);
  });

  // Anyone with the link can open a public user's submission, and its answers.
  it('has no links for a submitter who was not signed in', () => {
    const { body } = buildEmailCopy({ ...facts, signedIn: false, publicForm: true }, FORMS);
    expect(body).toContain('Confirmation ID: <strong>K7M2Q9XA</strong>');
    expect(body).toContain('>Thank you for your Permit application submission.</p>');
    expect(body).not.toContain('following links');
    expect(body).not.toContain('liens suivants');
    expect(body).not.toContain('<a ');
  });

  it('links only the submission for a signed-in submitter on a public form', () => {
    const { body } = buildEmailCopy({ ...facts, publicForm: true }, FORMS);
    expect(body).toContain(`href="${FORMS}/en/submission/s1"`);
    expect(body).not.toContain('my-submissions');
  });

  it('has no links when the forms app URL is not set', () => {
    expect(buildEmailCopy(facts, undefined).body).not.toContain('<a ');
  });

  it('cleans the form name and escapes it in the body', () => {
    const { subject, body } = buildEmailCopy(
      { ...facts, formName: '<b>Fees</b>\nsee https://evil.example' },
      FORMS,
    );
    expect(subject).toContain('<b>Fees</b> see [link removed]');
    expect(body).toContain('&lt;b&gt;Fees&lt;/b&gt;');
    expect(body).not.toContain('evil.example');
  });

  it('has words in English and French for every part', () => {
    expect(Object.keys(EMAIL_COPY)).toEqual(['en', 'fr']);
    expect(EMAIL_COPY.fr.secondLinkText).toBeTruthy();
  });
});
