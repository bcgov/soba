'use client';

import { Text } from '@bcgov/design-system-react-components';

type MutedHintProps = {
  children: React.ReactNode;
};

/** Secondary inline hint (e.g. workspace “Active” label beside a row link). */
export function MutedHint({ children }: MutedHintProps) {
  return (
    <Text size="small" color="secondary" elementType="span">
      {children}
    </Text>
  );
}
