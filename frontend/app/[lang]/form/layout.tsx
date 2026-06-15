import { notFound } from 'next/navigation';
import { loadFeaturesMeta } from '@/src/shared/config/featuresMeta';
import { createIsFeatureAllowed, FEATURE_CODES } from '@/src/shared/featureFlags/flags';

export default async function FormLayout({ children }: { children: React.ReactNode }) {
  const featuresMeta = await loadFeaturesMeta();
  const isFeatureAllowed = createIsFeatureAllowed(featuresMeta);

  if (!isFeatureAllowed(FEATURE_CODES.SUBMIT_MODE)) {
    notFound();
  }

  return <>{children}</>;
}
