import DictionaryProvider from './Providers';
import { Locale } from './dictionaries';
import { getDictionary } from './dictionaries';
import { Header } from '../ui/Header';
import { Footer } from '../ui/Footer';
import { SideNav } from '../ui/SideNav';
import { loadFeaturesMeta } from '@/src/shared/config/featuresMeta';
import { createIsFeatureAllowed } from '@/src/shared/featureFlags/flags';
import { getHeaderNavigationItems, getOverlayNavigationItems } from '@/src/app/plugins/registry';
import React from 'react';

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dictionary = await getDictionary(lang as Locale);
  const locale =
    dictionary.locale === 'en' || dictionary.locale === 'fr' ? dictionary.locale : 'en';

  const featuresMeta = await loadFeaturesMeta();
  const isFeatureAllowed = createIsFeatureAllowed(featuresMeta);
  const headerNavItems = getHeaderNavigationItems(locale, dictionary, isFeatureAllowed);
  const overlayNavItems = getOverlayNavigationItems(locale, dictionary, isFeatureAllowed);

  return (
    <DictionaryProvider dictionary={dictionary}>
      <Header headerNavItems={headerNavItems} overlayNavItems={overlayNavItems} />
      <div className="d-flex w-100">
        <aside
          className="p-2 d-flex flex-column flex-shrink-0"
          style={{ minWidth: '70px', maxWidth: '240px' }}
        >
          <SideNav />
        </aside>
        <main className="flex-grow-1 p-5 overflow-auto">{children}</main>
      </div>
      <Footer hideAcknowledgement={true} contact={React.createElement('span', null, '')} />
    </DictionaryProvider>
  );
}
