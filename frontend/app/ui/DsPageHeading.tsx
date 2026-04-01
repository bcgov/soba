'use client';

/**
 * `@bcgov/design-system-react-components` uses React Aria context (`createContext`), which only runs in
 * Client Components. App Router pages that stay Server Components (e.g. to export `generateMetadata`)
 * must not import those components directly—use this thin wrapper as the client boundary instead.
 */
import { Heading } from '@bcgov/design-system-react-components';

type DsPageHeadingProps = {
  id: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
  children: React.ReactNode;
};

export function DsPageHeading({ id, level = 2, className, children }: DsPageHeadingProps) {
  return (
    <Heading id={id} level={level} className={className}>
      {children}
    </Heading>
  );
}
