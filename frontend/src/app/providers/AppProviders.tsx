'use client';

import React, { useMemo } from 'react';
import { Provider } from 'react-redux';
import makeStore from '@/lib/store';
import { useDark } from '@/lib/hooks';
import { ThemeProvider } from '@/src/shared/theme/ThemeProvider';
import { getDictionary } from '@/app/[lang]/dictionaries';

type Dictionary = Awaited<ReturnType<typeof getDictionary>>;

const DictionaryContext = React.createContext<Dictionary | null>(null);

function ThemeBootstrap({ children }: { children: React.ReactNode }) {
  useDark();
  return <ThemeProvider>{children}</ThemeProvider>;
}

export default function AppProviders({
  dictionary,
  children,
}: {
  dictionary: Dictionary;
  children: React.ReactNode;
}) {
  const store = useMemo(() => makeStore(), []);

  return (
    <DictionaryContext.Provider value={dictionary}>
      <Provider store={store}>
        <ThemeBootstrap>{children}</ThemeBootstrap>
      </Provider>
    </DictionaryContext.Provider>
  );
}

export function useDictionary() {
  const dictionary = React.useContext(DictionaryContext);
  if (dictionary === null) {
    throw new Error('useDictionary hook must be used within AppProviders');
  }
  return dictionary;
}
