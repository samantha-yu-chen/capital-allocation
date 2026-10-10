import type { ScenarioBatchResult } from '../../engine/scenario.js';
import { translateText, type Locale } from './locale.js';

/** Library labels are user data. Generated case labels are authored display copy. */
export function localizeScenarioResult(locale: Locale, result: ScenarioBatchResult): ScenarioBatchResult {
  if (locale === 'en') return result;
  return { ...result, cells: result.cells.map(cell => ({ ...cell,
    label: cell.group === 'library' ? cell.label : translateText(locale, cell.label),
    note: cell.group === 'library' ? cell.note : translateText(locale, cell.note),
  })) };
}

import type { ScenarioCase, ScenarioProgress } from '../../engine/scenario.js';
import { scenarioProgressLine } from '../view/scenario-model.js';

/** Identify the authored stage separately from names, even names containing punctuation. */
export function localizeScenarioProgress(locale: Locale, progress: ScenarioProgress | null, cases: readonly ScenarioCase[]): string {
  const text = (value: string) => translateText(locale, value);
  if (locale === 'en' || !progress) return text(scenarioProgressLine(progress));
  const item = [...cases].sort((a,b)=>b.label.length-a.label.length)
    .find(item=>progress.stage===item.label || progress.stage.startsWith(`${item.label}: `));
  if (!item) return text(scenarioProgressLine(progress));
  const label = item.group === 'library' ? item.label : text(item.label);
  let suffix = progress.stage.slice(item.label.length);
  suffix = suffix.replace(/^: FIRE age (\d+)$/, '：FIRE 年齡 $1')
    .replace(/^: required salary \((.*)\)$/, (_,stage:string)=>`：所需年薪（${text(stage)}）`);
  return `${label}${suffix} — 已完成 ${progress.casesCompleted.toLocaleString('en-GB')}／${progress.casesPlanned.toLocaleString('en-GB')} 個情境`;
}

import type { Scenario } from '../../domain/scenarios.js';
import { libraryRows, type LibraryRow } from '../view/scenario-model.js';

/** Only notes with an app-owned origin are authored copy; custom notes stay literal. */
export function localizeLibraryRows(locale: Locale, scenarios: readonly Scenario[]): LibraryRow[] {
  const controlled=new Set(['migrated-v1','baseline','isa_heavy','pension_heavy','income_growth','property_heavy','no_property','aggressive_fire','conservative_fire']);
  return libraryRows(scenarios).map(row=>({...row,
    note: controlled.has(row.origin)||row.origin.startsWith('starter:') ? translateText(locale,row.note) : row.note,
  }));
}
