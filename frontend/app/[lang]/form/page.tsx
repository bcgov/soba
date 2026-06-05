import { redirect, notFound } from 'next/navigation';
import { hasLocale, type Locale } from '../dictionaries';
import { loadFeaturesMeta } from '@/src/shared/config/featuresMeta';
import { createIsFeatureAllowed, FEATURE_CODES } from '@/src/shared/featureFlags/flags';

type PageProps = {
  params: Promise<{ lang: string }>;
};

/** Entry point for Form.io v5 UI; submit page hosts the proxy smoke panel. */
export default async function Page({ params }: PageProps) {
  const featuresMeta = await loadFeaturesMeta();
  const isFeatureAllowed = createIsFeatureAllowed(featuresMeta);
  if (!isFeatureAllowed(FEATURE_CODES.SUBMIT_MODE)) {
    notFound();
  }

  const { lang } = await params;
  const locale = hasLocale(lang) ? lang : 'en';
  redirect(`/${locale as Locale}/submit`);
}
