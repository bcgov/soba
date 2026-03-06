'use client';

import React, { useMemo } from 'react';
import { Provider } from 'react-redux';
import makeStore from '@/lib/store';
import { getDictionary } from '@/app/[lang]/dictionaries';
import { NotificationToast } from '@/app/ui/base/NotificationToast';

type Dictionary = Awaited<ReturnType<typeof getDictionary>>;

const DictionaryContext = React.createContext<Dictionary | null>(null);

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
        {children}
        <NotificationToast />
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
