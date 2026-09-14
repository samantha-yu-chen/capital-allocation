import type { Profile } from '../../domain/contracts.js';
import { runMonteCarlo } from './simulation.js';
import type { SimulationControls } from './simulation.js';
import { createWorkerPool } from './worker-pool.js';

export type BrowserSimulationPool = ReturnType<typeof createWorkerPool>;

const defaultConcurrency = (): number => Math.min(4, Math.max(1, navigator.hardwareConcurrency || 1));

/**
 * A pool of simulation workers a caller can keep across several complete simulations.
 *
 * An analysis that runs many simulations in sequence — the scenario matrix runs one per cell —
 * would otherwise spawn and tear down a worker set per simulation. The batches are stateless and
 * aggregation still happens in path-index order, so reusing the workers cannot change a result; it
 * only stops the module graph being reloaded tens of times. The owner must close it.
 */
export const createBrowserSimulationPool = (concurrency = defaultConcurrency()): BrowserSimulationPool =>
  createWorkerPool(concurrency, () => {
    const worker = new Worker(new URL('./browser-worker.ts', import.meta.url), { type: 'module' });
    return {
      post: request => worker.postMessage(request),
      listen: (reply, error) => {
        worker.onmessage = event => reply(event.data);
        worker.onerror = event => error(new Error(event.message));
        worker.onmessageerror = () => error(new Error('Could not decode simulation worker reply'));
      },
      terminate: () => worker.terminate(),
    };
  });

/** Vite module workers. Chunk 4 should abort an old run when any input changes. */
export async function runMonteCarloBrowserPool(
  profile: Profile,
  controls: Omit<SimulationControls, 'executeBatch' | 'generator'> & { pool?: BrowserSimulationPool } = {},
) {
  const concurrency = controls.concurrency ?? defaultConcurrency();
  const shared = controls.pool;
  const pool = shared ?? createBrowserSimulationPool(concurrency);
  try { return await runMonteCarlo(profile, { ...controls, concurrency, executeBatch: pool.executeBatch }); }
  finally { if (!shared) pool.close(); }
}
