import { simulateBatch } from './simulation.js';
import type { SimulationRequest } from './simulation.js';
const scope = globalThis as unknown as { onmessage: (event: MessageEvent<SimulationRequest>) => void; postMessage: (message: unknown) => void };
scope.onmessage = ({ data }) => {
  try { scope.postMessage({ result: simulateBatch(data) }); }
  catch (error) { scope.postMessage({ error: { name: error instanceof Error ? error.name : 'Error', message: String(error) } }); }
};
