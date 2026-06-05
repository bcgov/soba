import { getDictionary, hasLocale, Locale } from '../../dictionaries';
import FormDesignerLoader from '@/src/features/designer/ui/FormDesignerLoader';
import { notFound } from 'next/navigation';
import { loadFeaturesMeta } from '@/src/shared/config/featuresMeta';
import { createIsFeatureAllowed, FEATURE_CODES } from '@/src/shared/featureFlags/flags';

type PageProps = {
  params: Promise<{ lang: string; formId: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const param = await params;
  if (!hasLocale(param.lang)) {
    param.lang = 'en';
  }
  const dict = await getDictionary(param.lang as Locale);
  return {
    title: `Form Designer | ${dict.general.title}`,
    description: dict.general.description,
  };
}

export default async function Page({ params }: PageProps) {
  const featuresMeta = await loadFeaturesMeta();
  const isFeatureAllowed = createIsFeatureAllowed(featuresMeta);
  if (!isFeatureAllowed(FEATURE_CODES.DESIGN_MODE)) {
    notFound();
  }

  const { formId } = await params;

  return (
    <section className="p-4" aria-labelledby="designer-heading">
      <FormDesignerLoader id={[formId]} />
    </section>
  );
}
