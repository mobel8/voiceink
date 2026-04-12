import { useLocale } from './i18nContext';
import { getTranslation, type TranslationKey, type Locale } from './translations';

export function useTranslation() {
  const locale = useLocale();

  function t(key: TranslationKey): string {
    return getTranslation(key, locale);
  }

  return { t, locale };
}
