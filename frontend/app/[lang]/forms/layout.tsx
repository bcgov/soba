import { notFound } from 'next/navigation';
import { loadFeaturesMeta } from '@/src/shared/config/featuresMeta';
import { createIsFeatureAllowed, FEATURE_CODES } from '@/src/shared/featureFlags/flags';

export default async function FormsLayout({ children }: { children: React.ReactNode }) {
  const featuresMeta = await loadFeaturesMeta();
  const isFeatureAllowed = createIsFeatureAllowed(featuresMeta);

  if (
    !isFeatureAllowed(FEATURE_CODES.SUBMIT_MODE) &&
    !isFeatureAllowed(FEATURE_CODES.DESIGN_MODE)
  ) {
    notFound();
  }

  return <>{children}</>;
}
