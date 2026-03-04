import DictionaryProvider from './Providers';
import { Locale } from './dictionaries';
import { getDictionary } from './dictionaries';
import { Header } from '../ui/Header';

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dictionary = await getDictionary(lang as Locale);
  return (
    <DictionaryProvider dictionary={dictionary}>
      <a href="#main-content" className="skip-link">
        {dictionary.header.skipToMain}
      </a>
      <Header />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl w-full">
        {children}
      </main>
    </DictionaryProvider>
  );
}
