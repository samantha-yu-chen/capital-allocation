import type { Profile } from '../../domain/contracts.js';
import { runMonteCarlo } from './simulation.js';
import type { SimulationControls } from './simulation.js';
import { createWorkerPool } from './worker-pool.js';
/** Vite module workers. Chunk 4 should abort an old run when any input changes. */
export async function runMonteCarloBrowserPool(profile: Profile, controls: Omit<SimulationControls, 'executeBatch' | 'generator'> = {}) {
  const concurrency = controls.concurrency ?? Math.min(4, Math.max(1, navigator.hardwareConcurrency || 1));
  const pool = createWorkerPool(concurrency, () => {
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
  try { return await runMonteCarlo(profile, { ...controls, concurrency, executeBatch: pool.executeBatch }); }
  finally { pool.close(); }
}
