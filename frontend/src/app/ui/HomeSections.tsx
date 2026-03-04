import { getHomeSections } from '@/src/app/plugins/registry';

export function HomeSections() {
  const sections = getHomeSections();

  return (
    <>
      {sections.map(({ id, Section }) => (
        <Section key={id} />
      ))}
    </>
  );
}
