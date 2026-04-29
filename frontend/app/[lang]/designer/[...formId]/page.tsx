import { getDictionary, hasLocale, Locale, resolveLocale } from '../../dictionaries';
import FormForm from '@/src/features/designer/ui/FormForm';

type PageProps = {
  params: Promise<{ lang: string; formId: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const param = await params;
  if (!hasLocale(param.lang)) {
    param.lang = 'en';
  }
  const dict = await getDictionary(param.lang as Locale); // ensure lang is valid
  return {
    title: `Form Designer | ${dict.general.title}`,
    description: dict.general.description,
  };
}

export default async function Page({ params }: PageProps) {
  const { lang, formId } = await params;
  const locale = resolveLocale(lang);
  await getDictionary(locale); // ensure locale is valid; metadata handled in generateMetadata

  return (
    <section className="p-4" aria-labelledby="designer-heading">
      <FormForm id={[formId]} />
    </section>
  );
}
