import { getDictionary, hasLocale, Locale } from './dictionaries';
import { HomeSections } from '@/src/app/ui/HomeSections';

export async function generateMetadata({ params }: PageProps<'/[lang]'>) {
  const param = await params;
  if (!hasLocale(param.lang)) {
    param.lang = 'en';
  }
  const dict = await getDictionary(param.lang as Locale); // ensure lang is valid
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
