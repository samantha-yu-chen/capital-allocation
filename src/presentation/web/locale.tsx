import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { LOCALE_STORAGE_KEY, message, readLocale, translateText, type Locale } from '../i18n/locale.js';
import type { MessageKey } from '../i18n/en.js';

const LocaleContext = createContext<{
  locale: Locale; setLocale: (locale: Locale) => void; t: (key: MessageKey) => string; text: (value: string) => string;
}>({ locale: 'en', setLocale: () => {}, t: key => message('en', key), text: value => value });

export function LocaleProvider({ children }: { children: ReactNode }): ReactNode {
  const [locale, setLocale] = useState<Locale>(() => {
    try { return readLocale(typeof localStorage === 'undefined' ? undefined : localStorage); }
    catch { return 'en'; }
  });
  useEffect(() => {
    document.documentElement.lang = locale;
    try { localStorage.setItem(LOCALE_STORAGE_KEY, locale); } catch { /* Storage is optional. */ }
  }, [locale]);
  return <LocaleContext.Provider value={{ locale, setLocale, t: key => message(locale, key), text: value => translateText(locale, value) }}>
    {children}
  </LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);

export function LanguagePicker(): ReactNode {
  const { locale, setLocale, t } = useLocale();
  return <label className="language-picker">{t('language')}
    <select aria-label="Language / 語言" value={locale}
      onChange={event => setLocale(event.target.value === 'zh-TW' ? 'zh-TW' : 'en')}>
      <option value="en" lang="en">English</option>
      <option value="zh-TW" lang="zh-TW">繁體中文</option>
    </select>
  </label>;
}
