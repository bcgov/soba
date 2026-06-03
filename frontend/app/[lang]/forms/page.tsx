import { DsPageHeading } from '@/app/ui/DsPageHeading';
import FormioV5FormListLoader from '@/src/features/formio-v5/ui/FormioV5FormListLoader';
import { getDictionary, resolveLocale } from '../dictionaries';

type PageProps = {
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const param = await params;
  const locale = resolveLocale(param.lang);
  const dict = await getDictionary(locale);
  return {
    title: `${dict.formioV5.formList.tableHeading} | ${dict.general.title}`,
    description: dict.general.description,
  };
}

/** Form.io v5 form list; open a row to fill at /{locale}/forms/[formId]. */
export default async function Page({ params }: PageProps) {
  const param = await params;
  const locale = resolveLocale(param.lang);
  const dict = await getDictionary(locale);
  return (
    <section className="p-4" aria-labelledby="forms-list-heading">
      <DsPageHeading id="forms-list-heading">{dict.formioV5.formList.tableHeading}</DsPageHeading>
      <FormioV5FormListLoader />
    </section>
  );
}
