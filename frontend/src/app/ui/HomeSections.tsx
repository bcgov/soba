import { getHomeSections } from '@/src/app/plugins/registry';
import { loadFeaturesMeta } from '@/src/shared/config/featuresMeta';
import { createIsFeatureAllowed } from '@/src/shared/featureFlags/flags';

export async function HomeSections() {
  const meta = await loadFeaturesMeta();
  const isFeatureAllowed = createIsFeatureAllowed(meta);
  const sections = getHomeSections(isFeatureAllowed);

  return (
    <>
      {sections.map(({ id, Section }) => (
        <Section key={id} />
      ))}
    </>
  );
}
