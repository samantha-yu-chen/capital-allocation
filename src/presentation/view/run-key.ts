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

export { stableStringify } from '../../domain/stable-json.js';
import { stableStringify } from '../../domain/stable-json.js';

export const runKey = (profile: Profile, ledgerOptions: LedgerOptions): string =>
  stableStringify({ profile, ledgerOptions });
