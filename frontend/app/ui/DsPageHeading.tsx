type DsPageHeadingProps = {
  id: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
  children: React.ReactNode;
};

const TAG_MAP = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
} as const;

export function DsPageHeading({ id, level = 2, className, children }: DsPageHeadingProps) {
  const Tag = TAG_MAP[level];
  return (
    <Tag id={id} className={className}>
      {children}
    </Tag>
  );
}
