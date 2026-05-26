import { getDictionary, hasLocale, Locale, resolveLocale } from '../dictionaries';
import FormForm from '@/src/features/designer/ui/FormForm';

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
    title: `Form Designer | ${dict.general.title}`,
    description: dict.general.description,
  };
}

export default async function Page({ params }: PageProps) {
  // Render the same FormForm component used by the catch-all route.
  // Pass an empty array so FormForm treats this as "no formId" (i.e. listing / creating).
  return (
    <section className="p-4" aria-labelledby="designer-heading">
      <FormForm id={[]} />
    </section>
  );
}
