import type { Profile } from '../../domain/contracts.js';
import { abortIfNeeded } from './simulation.js';
import type { MonteCarloResult, SimulationControls, SimulationProgress } from './simulation.js';
export type BrowserControls = Omit<SimulationControls, 'executeBatch' | 'generator'>;
export type CoordinatorRequest = { profile: Profile; batchSize: number; concurrency: number; ledgerOptions: BrowserControls['ledgerOptions'] };
export type CoordinatorReply = { progress: SimulationProgress } | { result: MonteCarloResult } | { error: { name: string; message: string } };
/** The coordinator keeps aggregation/sorting off the UI thread as well as ledger execution. */
export function runMonteCarloBrowser(profile: Profile, controls: BrowserControls = {}): Promise<MonteCarloResult> {
  return new Promise((resolve, reject) => {
    abortIfNeeded(controls.signal);
    const worker = new Worker(new URL('./browser-coordinator.ts', import.meta.url), { type: 'module' });
    const cleanup = () => { controls.signal?.removeEventListener('abort', abort); worker.terminate(); };
    const fail = (error: Error) => { cleanup(); reject(error); };
    const abort = () => fail(new DOMException('Simulation cancelled', 'AbortError'));
    controls.signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }: MessageEvent<CoordinatorReply>) => {
      if ('progress' in data) {
        try { controls.onProgress?.(data.progress); } catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
      } else if ('error' in data) {
        const error = new Error(data.error.message); error.name = data.error.name; fail(error);
      } else { cleanup(); resolve(data.result); }
    };
    worker.onerror = event => fail(new Error(event.message));
    worker.onmessageerror = () => fail(new Error('Could not decode simulation result'));
    try {
      worker.postMessage({ profile, batchSize: controls.batchSize ?? 100,
        concurrency: controls.concurrency ?? Math.min(4, Math.max(1, navigator.hardwareConcurrency || 1)),
        ledgerOptions: controls.ledgerOptions } satisfies CoordinatorRequest);
    } catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
  });
}
