import { translateFieldTemplate } from './field-templates.js';
import { fieldHelpZhTW } from './field-help-zh-TW.js';
import { textZhTW } from './text-zh-TW.js';
import { en, type MessageKey } from './en.js';
import { zhTW } from './zh-TW.js';

export type Locale = 'en' | 'zh-TW';
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_STORAGE_KEY = 'capital-allocation:locale:v1';
export const isLocale = (value: unknown): value is Locale => value === 'en' || value === 'zh-TW';
export const message = (locale: Locale, key: MessageKey): string =>
  (locale === 'zh-TW' ? zhTW : en)[key];

/** Display preference only: never stored in the profile or included in engine run keys. */
export function readLocale(storage: Pick<Storage, 'getItem'> | undefined): Locale {
  try {
    const value = storage?.getItem(LOCALE_STORAGE_KEY);
    return isLocale(value) ? value : DEFAULT_LOCALE;
  } catch { return DEFAULT_LOCALE; }
}

/** Translate only authored display copy; unknown text is preserved verbatim. */
export const translateText = (locale: Locale, value: string): string =>
  locale === 'en' ? value : textZhTW[value] ?? fieldHelpZhTW[value] ?? translateFieldTemplate(value) ?? value;
