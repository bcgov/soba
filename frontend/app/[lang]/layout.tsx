import DictionaryProvider from './Providers';
import { Locale } from './dictionaries';
import { getDictionary } from './dictionaries';
import { Header } from '../ui/Header';
import { loadFeaturesMeta } from '@/src/shared/config/featuresMeta';
import { createIsFeatureAllowed } from '@/src/shared/featureFlags/flags';
import { getNavigationItems } from '@/src/app/plugins/registry';

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dictionary = await getDictionary(lang as Locale);
  const locale = dictionary.locale === 'en' || dictionary.locale === 'fr' ? dictionary.locale : 'en';

  const featuresMeta = await loadFeaturesMeta();
  const isFeatureAllowed = createIsFeatureAllowed(featuresMeta);
  const navItems = getNavigationItems(locale, dictionary, isFeatureAllowed);

  return (
    <DictionaryProvider dictionary={dictionary}>
      <Header navItems={navItems} />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl w-full">
        {children}
      </main>
    </DictionaryProvider>
  );
}
