import Link from 'next/link';
import { getDictionary, resolveLocale } from '../../dictionaries';
import { DsPageHeading } from '@/app/ui/DsPageHeading';
import { AuthRedirect } from '@/src/app/ui/AuthRedirect';

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
      <section className="p-4" aria-labelledby="manage-workspace-heading">
        <DsPageHeading id="manage-workspace-heading">{dict.workspaces.manageHeading}</DsPageHeading>
        <p className="mt-3 text-muted" data-testid="manage-workspace-coming-soon">
          {dict.general.comingSoon}
        </p>
        <p className="mt-3">
          <Link href={`/${locale}/workspaces`} data-testid="back-to-workspaces">
            {dict.workspaces.tableHeading}
          </Link>
        </p>
      </section>
    </AuthRedirect>
  );
}
