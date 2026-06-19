import { getDictionary, resolveLocale } from '../../dictionaries';
import { AuthRedirect } from '@/src/app/ui/AuthRedirect';
import { WorkspaceManagePlaceholder } from '@/src/features/workspaces/ui/WorkspaceManagePlaceholder';

type PageProps = {
  params: Promise<{ lang: string; workspaceId: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const param = await params;
  const locale = resolveLocale(param.lang);
  const dict = await getDictionary(locale);
  return {
    title: `${dict.workspaces.manageHeading} | ${dict.general.title}`,
    description: dict.general.description,
  };
}

export default async function Page({ params }: PageProps) {
  const param = await params;
  const locale = resolveLocale(param.lang);
  const dict = await getDictionary(locale);

  return (
    <AuthRedirect to={`/${locale}`} ifLogged={false}>
      <section aria-labelledby="manage-workspace-heading">
        <WorkspaceManagePlaceholder
          locale={locale}
          manageHeading={dict.workspaces.manageHeading}
          comingSoon={dict.general.comingSoon}
          backLabel={dict.workspaces.tableHeading}
        />
      </section>
    </AuthRedirect>
  );
}
