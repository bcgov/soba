import { SubmissionList } from '@/src/features/submit-mode/ui/SubmissionList';
import { getDictionary, hasLocale, Locale } from '../../dictionaries';

type PageProps = {
  params: Promise<{ lang: string; id: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const param = await params;
  if (!hasLocale(param.lang)) {
    param.lang = 'en';
  }
  const dict = await getDictionary(param.lang as Locale);
  return {
    title: `Submissions | ${dict.general.title}`,
    description: dict.general.description,
  };
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return (
    <section className="p-4" aria-labelledby="submissions-heading">
      <SubmissionList formId={id} />
    </section>
  );
}
