import { getDictionary, resolveLocale } from '../dictionaries';
import FormDesignerLoader from '@/src/features/designer/ui/FormDesignerLoader';
import { PageLayout } from '@/src/components/PageLayout';
import { pageMetadata } from '@/src/shared/config/pageMetadata';
import { assertFeatureAllowed } from '@/src/shared/featureFlags/assertFeatureAllowed';
import { FEATURE_CODES } from '@/src/shared/featureFlags/flags';

type PageProps = {
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  return pageMetadata(params, (dict) => `Form Designer | ${dict.general.title}`);
}

export default async function Page({ params }: PageProps) {
  await assertFeatureAllowed(FEATURE_CODES.DESIGN_MODE);

  const { lang } = await params;
  const dict = await getDictionary(resolveLocale(lang));

  return (
    <PageLayout headingId="designer-heading" heading={dict.general.formDesigner} width="wide">
      <FormDesignerLoader />
    </PageLayout>
  );
}
