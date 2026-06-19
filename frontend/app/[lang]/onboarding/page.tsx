import { getDictionary, resolveLocale } from '../dictionaries';
import OnboardingPage from '@/src/features/onboarding/ui/OnboardingPage';

type PageProps = {
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const param = await params;
  const locale = resolveLocale(param.lang);
  const dict = await getDictionary(locale);
  return {
    title: `${dict.onboarding.heading} | ${dict.general.title}`,
    description: dict.general.description,
  };
}

export default function Page() {
  return (
    <section aria-labelledby="onboarding-heading">
      <OnboardingPage />
    </section>
  );
}
