import { getDictionary, resolveLocale } from '../../dictionaries';
import WorkspaceFormLoader from '@/src/features/workspaces/ui/WorkspaceFormLoader';

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

export default async function Page({ params }: Readonly<PageProps>) {
  const param = await params;

  return (
    <section aria-labelledby="workspace-form-heading">
      <WorkspaceFormLoader workspaceId={param.workspaceId} />
    </section>
  );
}
