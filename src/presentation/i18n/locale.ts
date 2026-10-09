import { attributionZhTW, attributionCaveatsZhTW, translateAttributionTemplate } from './attribution-zh-TW.js';
import { propertyZhTW, translatePropertyTemplate } from './property-zh-TW.js';
import { marginalZhTW, marginalBasisZhTW, translateMarginalTemplate } from './marginal-zh-TW.js';
import { solverZhTW, translateSolverTemplate } from './solver-zh-TW.js';
import { curveZhTW, translateCurveTemplate } from './curve-zh-TW.js';
import { overviewZhTW, overviewExtraZhTW, translateOverviewTemplate } from './overview-zh-TW.js';
import { commonZhTW, translateCommonTemplate } from './common-zh-TW.js';
import { profileZhTW, translateProfileTemplate } from './profile-zh-TW.js';
import { errorsZhTW, translateErrorTemplate } from './errors-zh-TW.js';
import { translateFireTemplate } from './fire-templates.js';
import { fireZhTW } from './fire-zh-TW.js';
import { starterZhTW } from './starter-zh-TW.js';
import { onboardingZhTW, translateOnboardingTemplate } from './onboarding-zh-TW.js';
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
export function translateText(locale: Locale, value: string): string {
  if (locale === 'en') return value;
  const key = value.trim();
  const translated = textZhTW[key] ?? fieldHelpZhTW[key] ?? starterZhTW[key] ?? onboardingZhTW[key] ?? fireZhTW[key] ?? errorsZhTW[key] ?? profileZhTW[key] ?? commonZhTW[key] ?? overviewZhTW[key] ?? overviewExtraZhTW[key] ?? curveZhTW[key] ?? solverZhTW[key] ?? propertyZhTW[key] ?? marginalZhTW[key] ?? marginalBasisZhTW[key] ?? attributionZhTW[key] ?? attributionCaveatsZhTW[key]
    ?? translateAttributionTemplate(key, item => translateText(locale, item))
    ?? translatePropertyTemplate(key)
    ?? translateMarginalTemplate(key, item => translateText(locale, item))
    ?? translateSolverTemplate(key, item => translateText(locale, item))
    ?? translateCurveTemplate(key, item => translateText(locale, item))
    ?? translateOverviewTemplate(key, item => translateText(locale, item))
    ?? translateCommonTemplate(key, item => translateText(locale, item))
    ?? translateProfileTemplate(key, item => translateText(locale, item))
    ?? translateErrorTemplate(key, item => translateText(locale, item))
    ?? translateFireTemplate(key, item => translateText(locale, item)) ?? translateFieldTemplate(key) ?? translateOnboardingTemplate(key, item => translateText(locale, item));
  if (translated === undefined) return value;
  return `${value.slice(0, value.length - value.trimStart().length)}${translated}${value.slice(value.trimEnd().length)}`;
}
