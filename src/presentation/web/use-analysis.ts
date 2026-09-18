/**
 * Run state for the two package-6 analyses.
 *
 * The rules are the ones the FIRE screen already follows, generalised over the result type:
 * a result belongs to exactly one input key, any change to those inputs discards it and aborts the
 * run producing it, and a cancelled or failed run publishes nothing. Neither analysis reduces the
 * configured path count to finish sooner, so progress is reported in both dimensions — how many
 * complete simulations have finished, and how far the current one has got.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type AnalysisState<R, P> =
  | { status: 'idle' }
  | { status: 'running'; progress: P | null }
  | { status: 'done'; result: R; seconds: number; key: string }
  | { status: 'cancelled' }
  | { status: 'error'; name: string; message: string };

export interface AnalysisRunner<R, P> {
  state: AnalysisState<R, P>;
  /** True when a published result was thrown away because the inputs changed. */
  invalidated: boolean;
  run: (launch: (controls: { signal: AbortSignal; onProgress: (progress: P) => void }) => Promise<R>) => void;
  cancel: () => void;
}

/** @param key identifies the inputs; when it changes the run is aborted and the result discarded. */
export function useAnalysis<R, P>(key: string | null): AnalysisRunner<R, P> {
  const [state, setState] = useState<AnalysisState<R, P>>({ status: 'idle' });
  const [invalidated, setInvalidated] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const token = useRef(0);
  const hadResult = useRef(false);

  useEffect(() => {
    token.current += 1;
    controller.current?.abort();
    controller.current = null;
    setInvalidated(hadResult.current);
    hadResult.current = false;
    setState({ status: 'idle' });
  }, [key]);

  useEffect(() => () => controller.current?.abort(), []);

  const run = useCallback((launch: (controls: { signal: AbortSignal; onProgress: (progress: P) => void }) => Promise<R>) => {
    if (key === null) return;
    const completedKey = key;
    token.current += 1;
    const mine = token.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setInvalidated(false);
    setState({ status: 'running', progress: null });
    const started = performance.now();
    void launch({
      signal: abort.signal,
      onProgress: progress => { if (token.current === mine) setState({ status: 'running', progress }); },
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
    ).finally(() => { if (controller.current === abort) controller.current = null; });
  }, [key]);

  return { state, invalidated, run, cancel: useCallback(() => controller.current?.abort(), []) };
}
