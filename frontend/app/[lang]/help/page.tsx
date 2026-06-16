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
    title: `${dict.general.help} | ${dict.general.title}`,
    description: dict.general.description,
  };
}

export default async function Page({ params }: PageProps) {
  const param = await params;
  const locale = resolveLocale(param.lang);
  const dict = await getDictionary(locale);

  return (
    <section className="p-4" aria-labelledby="help-heading">
      <DsPageHeading id="help-heading">{dict.general.help}</DsPageHeading>
      <p className="mt-3 text-muted" data-testid="help-coming-soon">
        {dict.general.comingSoon}
      </p>
    </section>
  );
}
