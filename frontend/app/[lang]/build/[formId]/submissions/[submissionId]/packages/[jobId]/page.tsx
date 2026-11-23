import { getDictionary, resolveLocale } from '../../../../../../dictionaries';
import { SubmissionPackageDownload } from '@/src/features/designer/ui/SubmissionPackageDownload';
import { PageLayout } from '@/src/components/PageLayout';
import { pageMetadata } from '@/src/shared/config/pageMetadata';
import { assertFeatureAllowed } from '@/src/shared/featureFlags/assertFeatureAllowed';
import { FEATURE_CODES } from '@/src/shared/featureFlags/flags';

type PageProps = {
  params: Promise<{ lang: string; formId: string; submissionId: string; jobId: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  return pageMetadata(
    params,
    (dict) => `${dict.submission.package.pageTitle} | ${dict.general.title}`,
  );
}

export default async function Page({ params }: Readonly<PageProps>) {
  await assertFeatureAllowed(FEATURE_CODES.DESIGN_MODE);

  const { lang, formId, submissionId, jobId } = await params;
  const dict = await getDictionary(resolveLocale(lang));

  return (
    <PageLayout headingId="submission-package-heading" heading={dict.submission.package.pageTitle}>
      <SubmissionPackageDownload
        key={jobId}
        formId={formId}
        submissionId={submissionId}
        jobId={jobId}
      />
    </PageLayout>
  );
}
