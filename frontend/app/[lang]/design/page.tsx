import { DsPageHeading } from '@/app/ui/DsPageHeading';
import { getDictionary, hasLocale, Locale, resolveLocale } from '../dictionaries';

type PageProps = {
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const param = await params;
  const locale = resolveLocale(param.lang);
  const dict = await getDictionary(locale);
  return {
    title: `${dict.header.design} | ${dict.general.title}`,
    description: dict.general.description,
  };
}

export default async function Page({ params }: PageProps) {
  const { lang } = await params;
  const locale = hasLocale(lang) ? lang : 'en';
  const dict = await getDictionary(locale as Locale);
  return (
    <section className="p-4" aria-labelledby="design-mode-heading">
      <DsPageHeading id="design-mode-heading">{dict.header.design}</DsPageHeading>
    </section>
  );
}
