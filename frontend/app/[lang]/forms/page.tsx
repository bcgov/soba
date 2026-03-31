import { redirect } from 'next/navigation';
import { hasLocale, type Locale } from '../dictionaries';

type PageProps = {
  params: Promise<{ lang: string }>;
};

/** Entry point for Form.io v5 UI; submit page hosts the proxy smoke panel. */
export default async function Page({ params }: PageProps) {
  const { lang } = await params;
  const locale = hasLocale(lang) ? lang : 'en';
  redirect(`/${locale as Locale}/submit`);
}
