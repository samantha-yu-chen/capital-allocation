import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import type { Profile } from '../../domain/contracts.js';
import { runMonteCarlo } from './simulation.js';
import type { SimulationControls } from './simulation.js';
import { createWorkerPool } from './worker-pool.js';
/** Node-only entry point. Keep out of the browser's engine barrel. */
export async function runMonteCarloNode(profile: Profile, controls: Omit<SimulationControls, 'executeBatch' | 'generator'> = {}) {
  const concurrency = controls.concurrency ?? Math.min(4, availableParallelism());
  const pool = createWorkerPool(concurrency, () => {
    const worker = new Worker(new URL('./node-worker.js', import.meta.url));
    return {
      post: request => worker.postMessage(request),
      listen: (reply, error) => {
        worker.removeAllListeners('message'); worker.removeAllListeners('error'); worker.removeAllListeners('exit');
        worker.on('message', reply); worker.on('error', error);
        worker.on('exit', code => { if (code !== 0) error(new Error(`Simulation worker exited with code ${code}`)); });
      },
      terminate: () => { void worker.terminate(); },
    };
  });
  try { return await runMonteCarlo(profile, { ...controls, concurrency, executeBatch: pool.executeBatch }); }
  finally { pool.close(); }
}
