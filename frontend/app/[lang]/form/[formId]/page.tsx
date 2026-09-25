import { PageLayout } from '@/src/components/PageLayout';
import StartSubmission from '@/src/features/submit-mode/ui/StartSubmission';
import { getDictionary, resolveLocale } from '../../dictionaries';
import { pageMetadata } from '@/src/shared/config/pageMetadata';
import { assertFeatureAllowed } from '@/src/shared/featureFlags/assertFeatureAllowed';
import { FEATURE_CODES } from '@/src/shared/featureFlags/flags';

type PageProps = {
  params: Promise<{ lang: string; formId: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  return pageMetadata(
    params,
    (dict) => `${dict.formioV5.formRender.pageTitle} | ${dict.general.title}`,
  );
}

export default async function Page({ params }: PageProps) {
  await assertFeatureAllowed(FEATURE_CODES.SUBMIT_MODE);

  const { lang } = await params;
  const locale = resolveLocale(lang);
  const dict = await getDictionary(locale);
  return (
    <PageLayout headingId="formio-v5-render-heading" heading={dict.formioV5.formRender.pageTitle}>
      <StartSubmission />
    </PageLayout>
  );
}
