'use client';

import { Link, Text } from '@bcgov/design-system-react-components';
import { ListPageLayout } from '@/src/components/ListPageLayout';
import { DsPageHeading } from '@/app/ui/DsPageHeading';
import styles from './WorkspaceManagePlaceholder.module.css';

type WorkspaceManagePlaceholderProps = {
  locale: string;
  manageHeading: string;
  comingSoon: string;
  backLabel: string;
};

export function WorkspaceManagePlaceholder({
  locale,
  manageHeading,
  comingSoon,
  backLabel,
}: WorkspaceManagePlaceholderProps) {
  return (
    <ListPageLayout>
      <DsPageHeading id="manage-workspace-heading">{manageHeading}</DsPageHeading>
      <Text color="secondary" data-testid="manage-workspace-coming-soon">
        {comingSoon}
      </Text>
      <p className={styles.backLink}>
        <Link href={`/${locale}/workspaces`} data-testid="back-to-workspaces">
          {backLabel}
        </Link>
      </p>
    </ListPageLayout>
  );
}
