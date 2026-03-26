import { getDictionary, hasLocale, Locale } from '../dictionaries';
import FormForm from '@/src/features/designer/ui/FormForm';

type PageProps = {
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const param = await params;
  if (!hasLocale(param.lang)) {
    param.lang = 'en';
  }
  const dict = await getDictionary(param.lang as Locale); // ensure lang is valid
  return {
    title: `Workspaces | ${dict.general.title}`,
    description: dict.general.description,
  };
}

export default function Page({ params }: PageProps) {
  return (
    <section className="p-4" aria-labelledby="design-mode-heading">
      <FormForm />
    </section>
  );
}
