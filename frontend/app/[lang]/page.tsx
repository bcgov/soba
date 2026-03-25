import { getDictionary, resolveLocale } from './dictionaries';
import { HomeSections } from '@/src/app/ui/HomeSections';

type PageProps = {
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const param = await params;
  const locale = resolveLocale(param.lang);
  const dict = await getDictionary(locale);
  return {
    title: `Workspaces | ${dict.general.title}`,
    description: dict.general.description,
  };
}

export default async function Page() {
  return (
    <div>
      <HomeSections />
    </div>
  );
}
