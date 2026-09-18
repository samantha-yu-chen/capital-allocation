/**
 * Runs the real Monte Carlo engine in a worker, with progress, cancellation, error reporting and
 * stale-result invalidation.
 *
 * Rules taken from the chunk-3 handoff:
 * - a cancelled or failed run never publishes a partial probability, so those states clear the result;
 * - a result belongs to exactly one input key, and any change to the inputs discards it immediately
 *   and aborts the run that is producing it;
 * - the requested path count is never reduced to fit a time budget.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Profile } from '../../domain/contracts.js';
import type { LedgerOptions, MonteCarloResult } from '../../engine/index.js';
import { runMonteCarloBrowser } from '../../engine/monte-carlo/browser.js';

export type RunState =
  | { status: 'idle' }
  | { status: 'running'; completed: number; total: number }
  | { status: 'done'; result: MonteCarloResult; seconds: number; key: string }
  | { status: 'cancelled' }
  | { status: 'error'; name: string; message: string };

export interface Transport {
  concurrency: number;
  batchSize: number;
}

export interface MonteCarloRunner {
  state: RunState;
  /** True when a published result was thrown away because the inputs changed. */
  invalidated: boolean;
  run: (profile: Profile, ledgerOptions: Partial<LedgerOptions>, transport: Transport) => void;
  cancel: () => void;
}

/**
 * @param key identifies the inputs. When it changes, an in-flight run is aborted and any published
 * result is discarded. Concurrency and batch size are deliberately outside the key: chunk 3
 * aggregates in absolute path-index order, so they cannot change the numbers.
 */
export function useMonteCarlo(key: string | null): MonteCarloRunner {
  const [state, setState] = useState<RunState>({ status: 'idle' });
  const [invalidated, setInvalidated] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const token = useRef(0);
  const hadResult = useRef(false);

  useEffect(() => {
    // Any input change invalidates: abandon the run in flight and drop the published result.
    token.current += 1;
    controller.current?.abort();
    controller.current = null;
    setInvalidated(hadResult.current);
    hadResult.current = false;
    setState({ status: 'idle' });
  }, [key]);

  useEffect(() => () => controller.current?.abort(), []);

  const run = useCallback((profile: Profile, ledgerOptions: Partial<LedgerOptions>, transport: Transport) => {
    if (key === null) return;
    const completedKey = key;
    token.current += 1;
    const mine = token.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setInvalidated(false);
    setState({ status: 'running', completed: 0, total: profile.simulation.count });
    const started = performance.now();
    void runMonteCarloBrowser(profile, {
      signal: abort.signal,
      concurrency: transport.concurrency,
      batchSize: transport.batchSize,
      ledgerOptions,
      onProgress: progress => {
        if (token.current !== mine) return;
        setState({ status: 'running', completed: progress.completed, total: progress.total });
      },
    }).then(
      result => {
        if (token.current !== mine) return;
        hadResult.current = true;
        setState({ status: 'done', result, seconds: (performance.now() - started) / 1000, key: completedKey });
      },
      (error: unknown) => {
        if (token.current !== mine) return;
        const thrown = error instanceof Error ? error : new Error(String(error));
        setState(thrown.name === 'AbortError'
          ? { status: 'cancelled' }
          : { status: 'error', name: thrown.name, message: thrown.message });
      },
    ).finally(() => {
      if (controller.current === abort) controller.current = null;
    });
  }, [key]);

  const cancel = useCallback(() => controller.current?.abort(), []);

  return { state, invalidated, run, cancel };
}
