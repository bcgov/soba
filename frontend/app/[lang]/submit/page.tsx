import { DsPageHeading } from '@/app/ui/DsPageHeading';
import { getDictionary, hasLocale, Locale } from '../dictionaries';

type PageProps = {
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const param = await params;
  if (!hasLocale(param.lang)) {
    param.lang = 'en';
  }
  const dict = await getDictionary(param.lang as Locale);
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
    </section>
  );
}
