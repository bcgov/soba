import { DsPageHeading } from '@/app/ui/DsPageHeading';
import FormioV5FormRenderLoader from '@/src/features/formio-v5/ui/FormioV5FormRenderLoader';
import { getDictionary, resolveLocale } from '../../dictionaries';

type PageProps = {
  params: Promise<{ lang: string; formId: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const param = await params;
  const locale = resolveLocale(param.lang);
  const dict = await getDictionary(locale);
  const t = dict.formioV5.formRender.pageTitle;
  return {
    title: `${t} | ${dict.general.title}`,
    description: dict.general.description,
  };
}

export default async function Page({ params }: PageProps) {
  const { lang } = await params;
  const locale = resolveLocale(lang);
  const dict = await getDictionary(locale);
  return (
    <section className="p-4" aria-labelledby="formio-v5-render-heading">
      <DsPageHeading id="formio-v5-render-heading">{dict.formioV5.formRender.pageTitle}</DsPageHeading>
      <FormioV5FormRenderLoader />
    </section>
  );
}
