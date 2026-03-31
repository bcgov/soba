import { DsPageHeading } from '@/app/ui/DsPageHeading';
import MetaReviewClientLoader from '@/src/features/meta-review/ui/MetaReviewClientLoader';
import { getDictionary, hasLocale, Locale, resolveLocale } from '../dictionaries';

type PageProps = {
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const param = await params;
  const locale = resolveLocale(param.lang);
  const dict = await getDictionary(locale);
  const title = dict.metaPage?.title ?? 'Meta';
  return {
    title: `${title} | ${dict.general.title}`,
    description: dict.general.description,
  };
}

export default async function Page({ params }: PageProps) {
  const { lang } = await params;
  const locale = hasLocale(lang) ? lang : 'en';
  const dict = await getDictionary(locale as Locale);
  const heading = dict.metaPage?.title ?? 'Meta';
  return (
    <section className="p-4" aria-labelledby="meta-review-heading">
      <DsPageHeading id="meta-review-heading">{heading}</DsPageHeading>
      <div className="mt-4">
        <MetaReviewClientLoader />
      </div>
    </section>
  );
}
