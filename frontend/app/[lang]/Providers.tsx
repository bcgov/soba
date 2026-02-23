'use client';
import React, { useMemo } from 'react';
import { Provider } from 'react-redux';
import makeStore from '../../lib/store';
import { useDark } from '../../lib/hooks/useDark';
import { getDictionary } from './dictionaries';
import { NotificationToast } from '../ui/base/NotificationToast';

type Dictionary = Awaited<ReturnType<typeof getDictionary>>;

const DictionaryContext = React.createContext<Dictionary | null>(null);

function ThemeApplier({ children }: { children: React.ReactNode }) {
  // This hook needs to run after the Provider is mounted so it can access the store.
  useDark();
  return (
    <>
      {children}
      <NotificationToast />
    </>
  );
}

export default function DictionaryProvider({
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
        <ThemeApplier>{children}</ThemeApplier>
      </Provider>
    </DictionaryContext.Provider>
  );
}

export function useDictionary() {
  const dictionary = React.useContext(DictionaryContext);
  if (dictionary === null) {
    throw new Error('useDictionary hook must be used within DictionaryProvider');
  }

  return dictionary;
}
