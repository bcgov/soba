import { DsPageHeading } from '@/app/ui/DsPageHeading';
import FormioV5FormListLoader from '@/src/features/formio-v5/ui/FormioV5FormListLoader';
import { getDictionary, hasLocale, Locale, resolveLocale } from '../dictionaries';

type PageProps = {
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const param = await params;
  const locale = resolveLocale(param.lang);
  const dict = await getDictionary(locale);
  return {
    title: `${dict.header.submit} | ${dict.general.title}`,
    description: dict.general.description,
  };
}

export default async function Page({ params }: PageProps) {
  const { lang } = await params;
  const locale = hasLocale(lang) ? lang : 'en';
  const dict = await getDictionary(locale as Locale);
  return (
    <section className="p-4" aria-labelledby="submit-mode-heading">
      <DsPageHeading id="submit-mode-heading">{dict.header.submit}</DsPageHeading>
      <FormioV5FormListLoader />
    </section>
  );
}
