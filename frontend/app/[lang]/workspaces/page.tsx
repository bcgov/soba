import { getDictionary, resolveLocale } from '../dictionaries';
import WorkspaceList from '@/src/features/workspaces/ui/WorkspaceList';
import { loadFeaturesMeta } from '@/src/shared/config/featuresMeta';
import { createIsFeatureAllowed, FEATURE_CODES } from '@/src/shared/featureFlags/flags';

type PageProps = {
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const param = await params;
  const locale = resolveLocale(param.lang);
  const dict = await getDictionary(locale);
  return {
    title: `${dict.workspaces.tableHeading} | ${dict.general.title}`,
    description: dict.general.description,
  };
}

export default async function Page() {
  const featuresMeta = await loadFeaturesMeta();
  const isFeatureAllowed = createIsFeatureAllowed(featuresMeta);

  return (
    <section aria-labelledby="workspaces-heading">
      <WorkspaceList
        showFormsAction={
          isFeatureAllowed(FEATURE_CODES.SUBMIT_MODE) ||
          isFeatureAllowed(FEATURE_CODES.DESIGN_MODE)
        }
      />
    </section>
  );
}
