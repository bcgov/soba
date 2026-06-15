import { getDictionary, resolveLocale } from '../dictionaries';
import { DsPageHeading } from '@/app/ui/DsPageHeading';

type PageProps = {
  params: Promise<{ lang: string }>;
};
export async function generateMetadata({ params }: PageProps) {
  const param = await params;
  const locale = resolveLocale(param.lang);
  const dict = await getDictionary(locale);
  return {
    title: `${dict.general.feedback} | ${dict.general.title}`,
    description: dict.general.description,
  };
}

export default async function Page({ params }: PageProps) {
  const param = await params;
  const locale = resolveLocale(param.lang);
  const dict = await getDictionary(locale);

  return (
    <section className="p-4" aria-labelledby="feedback-heading">
      <DsPageHeading id="feedback-heading">{dict.general.feedback}</DsPageHeading>
      <p className="mt-3 text-muted" data-testid="feedback-coming-soon">
        {dict.general.comingSoon}
      </p>
    </section>
  );
}
