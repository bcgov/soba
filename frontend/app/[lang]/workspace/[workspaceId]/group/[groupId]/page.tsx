import { getDictionary, resolveLocale } from '../../../../dictionaries';
import WorkspaceGroupFormLoader from '@/src/features/workspaces/ui/WorkspaceGroupFormLoader';
import { PageLayout } from '@/src/components/PageLayout';
import { pageMetadata } from '@/src/shared/config/pageMetadata';

type PageProps = {
  params: Promise<{ lang: string; workspaceId: string; groupId: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { groupId } = await params;
  const isEdit = groupId !== 'new';
  return pageMetadata(
    params,
    (dict) =>
      `${isEdit ? dict.workspaces.groups.editGroup : dict.workspaces.groups.addGroup} | ${dict.general.title}`,
  );
}

export default async function Page({ params }: Readonly<PageProps>) {
  const param = await params;
  const locale = resolveLocale(param.lang);
  const dict = await getDictionary(locale);
  const isEdit = param.groupId !== 'new';
  const heading = isEdit ? dict.workspaces.groups.editGroup : dict.workspaces.groups.addGroup;

  return (
    <PageLayout headingId="workspace-group-heading" heading={heading}>
      <WorkspaceGroupFormLoader
        workspaceId={param.workspaceId}
        groupId={isEdit ? param.groupId : undefined}
      />
    </PageLayout>
  );
}
