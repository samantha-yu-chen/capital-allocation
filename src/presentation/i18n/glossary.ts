import type { GlossaryEntry } from '../view/glossary.js';
import type { Locale } from './locale.js';
import { glossaryZhTW } from './glossary-zh-TW.js';

export const localizeGlossaryEntry = (locale: Locale, entry: GlossaryEntry): GlossaryEntry => {
  const translated = locale === 'zh-TW' ? glossaryZhTW[entry.id] : undefined;
  return translated ? { ...entry, ...translated } : entry;
};
