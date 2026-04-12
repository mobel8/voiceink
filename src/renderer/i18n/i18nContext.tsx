import React, { createContext, useContext } from 'react';
import { useStore } from '../stores/useStore';
import type { Locale } from './translations';

const I18nContext = createContext<Locale>('fr');

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const settings = useStore((s) => s.settings);
  const locale: Locale = (settings?.ui?.language as Locale) || 'fr';
  return (
    <I18nContext.Provider value={locale}>
      {children}
    </I18nContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(I18nContext);
}
