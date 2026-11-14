import { buildEmailCopy, EMAIL_COPY } from '../../../src/features/submitter-email-copy/email';

const facts = {
  submissionId: 's1',
  formName: 'Permit application',
  confirmationCode: 'K7M2Q9XA',
  signedIn: true,
};
const FORMS = 'https://forms.example';

describe('buildEmailCopy', () => {
  it('writes one email in both languages, the subject ending with the Confirmation ID', () => {
    const { subject, body, bodyType } = buildEmailCopy(facts, FORMS);
    expect(bodyType).toBe('html');
    expect(subject).toBe(
      'Your submission to Permit application was submitted / Votre soumission à Permit application a été soumise (K7M2Q9XA)',
    );
    expect(body).toContain('Confirmation ID: <strong>K7M2Q9XA</strong>');
    expect(body).toContain('ID de confirmation : <strong>K7M2Q9XA</strong>');
    expect(body).toContain(
      'Thank you for your Permit application submission. You asked for this copy on the confirmation screen.',
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

  // The public user's submissions are no one's own, so there is no list to link.
  it('leaves out the past submissions link for a submitter who was not signed in', () => {
    const { body } = buildEmailCopy({ ...facts, signedIn: false }, FORMS);
    expect(body).toContain('/submission/s1');
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
