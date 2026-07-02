import { getDictionary, resolveLocale } from '../dictionaries';
import FormList from '@/src/features/designer/ui/FormList';
import { AuthRedirect } from '@/src/app/ui/AuthRedirect';
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
    title: `${dict.formioV5.formList.tableHeading} | ${dict.general.title}`,
    description: dict.general.description,
  };
}

export default async function Page({ params }: PageProps) {
  const featuresMeta = await loadFeaturesMeta();
  const isFeatureAllowed = createIsFeatureAllowed(featuresMeta);

  const param = await params;
  const locale = resolveLocale(param.lang);
  return (
    <AuthRedirect to={`/${locale}`} ifLogged={false}>
      <div>
        <FormList
          designModeEnabled={isFeatureAllowed(FEATURE_CODES.DESIGN_MODE)}
          submitModeEnabled={isFeatureAllowed(FEATURE_CODES.SUBMIT_MODE)}
        />
      </div>
    </AuthRedirect>
  );
}
