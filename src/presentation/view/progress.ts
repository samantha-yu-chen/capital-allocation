import { count } from './format.js';

export type ProgressUnit = 'paths' | 'scenarios';
export const progressCountLine = (completed: number, total: number, unit: ProgressUnit = 'paths'): string =>
  `${count(completed)} of ${count(total)} ${unit} complete`;
