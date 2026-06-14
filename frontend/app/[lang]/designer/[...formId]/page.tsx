import { getDictionary, hasLocale, Locale } from '../../dictionaries';
import FormDesignerLoader from '@/src/features/designer/ui/FormDesignerLoader';
import { DsPageHeading } from '@/app/ui/DsPageHeading';
import { notFound } from 'next/navigation';
import { loadFeaturesMeta } from '@/src/shared/config/featuresMeta';
import { createIsFeatureAllowed, FEATURE_CODES } from '@/src/shared/featureFlags/flags';

type PageProps = {
  // `[...formId]` is a catch-all segment, so Next.js provides `formId` as a string[].
  params: Promise<{ lang: string; formId: string[] }>;
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

  const { lang, formId } = await params;
  const dict = await getDictionary((hasLocale(lang) ? lang : 'en') as Locale);

  return (
    <section className="p-4" aria-labelledby="designer-heading">
      <DsPageHeading id="designer-heading" className="visually-hidden">
        {dict.general.formDesigner}
      </DsPageHeading>
      <FormDesignerLoader id={formId} />
    </section>
  );
}
