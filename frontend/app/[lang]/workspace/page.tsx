import { getDictionary, resolveLocale } from '../dictionaries';
import { AuthRedirect } from '@/src/app/ui/AuthRedirect';
import WorkspaceFormLoader from '@/src/features/workspaces/ui/WorkspaceFormLoader';

type PageProps = {
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const param = await params;
  const locale = resolveLocale(param.lang);
  const dict = await getDictionary(locale);
  return {
    title: `${dict.workspaces.createHeading} | ${dict.general.title}`,
    description: dict.general.description,
  };
}

export default async function Page({ params }: PageProps) {
  const param = await params;
  const locale = resolveLocale(param.lang);

  return (
    <AuthRedirect to={`/${locale}`} ifLogged={false}>
      <section aria-labelledby="workspace-form-heading">
        <WorkspaceFormLoader />
      </section>
    </AuthRedirect>
  );
}
