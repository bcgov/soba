import { SubmissionList } from '@/src/features/submit-mode/ui/SubmissionList';
import { PageLayout } from '@/src/components/PageLayout';
import { getDictionary, resolveLocale } from '../../dictionaries';
import { pageMetadata } from '@/src/shared/config/pageMetadata';
import { assertFeatureAllowed } from '@/src/shared/featureFlags/assertFeatureAllowed';
import { FEATURE_CODES } from '@/src/shared/featureFlags/flags';

type PageProps = {
  params: Promise<{ lang: string; formId: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  return pageMetadata(params, (dict) => `${dict.submission.submissions} | ${dict.general.title}`);
}

export default async function Page({ params }: PageProps) {
  await assertFeatureAllowed(FEATURE_CODES.SUBMIT_MODE);

  const param = await params;
  const dict = await getDictionary(resolveLocale(param.lang));
  return (
    <PageLayout headingId="submissions-heading" heading={dict.submission.submissions}>
      <SubmissionList formId={param.formId} />
    </PageLayout>
  );
}
