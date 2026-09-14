import { parentPort } from 'node:worker_threads';
import { simulateBatch } from './simulation.js';
import type { SimulationRequest } from './simulation.js';
parentPort!.on('message', (request: SimulationRequest) => {
  try { parentPort!.postMessage({ result: simulateBatch(request) }); }
  catch (error) { parentPort!.postMessage({ error: { name: error instanceof Error ? error.name : 'Error', message: String(error) } }); }
});
