'use client';

import { TagGroup, TagList } from '@bcgov/design-system-react-components';

export type StatusTagVariant = 'primary' | 'info' | 'neutral' | 'success';

const VARIANT_COLORS: Record<
  StatusTagVariant,
  'bc-blue' | 'blue' | 'grey' | 'green'
> = {
  primary: 'bc-blue',
  info: 'blue',
  neutral: 'grey',
  success: 'green',
};

type StatusTagProps = {
  id: string;
  label: string;
  variant?: StatusTagVariant;
  'data-testid'?: string;
};

/**
 * BCDS tag pill for table status/role cells. Shared by workspace roles and
 * submission workflow states so chips look identical across list pages.
 */
export function StatusTag({
  id,
  label,
  variant = 'neutral',
  'data-testid': testId,
}: Readonly<StatusTagProps>) {
  return (
    <TagGroup aria-label={label} data-testid={testId}>
      <TagList
        items={[
          {
            id,
            textValue: label,
            color: VARIANT_COLORS[variant],
            tagStyle: 'circular',
            size: 'small',
            children: label,
          },
        ]}
      />
    </TagGroup>
  );
}

export function workspaceRoleToVariant(role?: string): StatusTagVariant {
  const normalized = (role || '').toLowerCase();
  if (normalized === 'owner') return 'primary';
  if (normalized === 'admin') return 'info';
  return 'neutral';
}

export function workflowStateToVariant(state?: string): StatusTagVariant {
  return (state || '').toLowerCase() === 'submitted' ? 'success' : 'neutral';
}
