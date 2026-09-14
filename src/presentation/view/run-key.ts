/**
 * Stale-result detection.
 *
 * A published Monte Carlo result is only meaningful for the exact inputs that produced it. The key
 * covers the validated profile (which carries the path count and seed) and the resolved ledger
 * options. It deliberately excludes concurrency and batch size: chunk 3 aggregates in absolute
 * path-index order, so scheduling granularity cannot change the numbers, and changing it must not
 * throw away a valid result.
 */
import type { LedgerOptions } from '../../engine/index.js';
import type { Profile } from '../../domain/contracts.js';

/** Key order is not guaranteed across object literals, so sort before serialising. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

export const runKey = (profile: Profile, ledgerOptions: LedgerOptions): string =>
  stableStringify({ profile, ledgerOptions });
