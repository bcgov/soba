import { getDictionary, hasLocale, Locale } from '../../dictionaries';
import FormDesignerLoader from '@/src/features/designer/ui/FormDesignerLoader';

type PageProps = {
  params: Promise<{ lang: string; formId: string }>;
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
  const { formId } = await params;

  return (
    <section className="p-4" aria-labelledby="designer-heading">
      <FormDesignerLoader id={[formId]} />
    </section>
  );
}
