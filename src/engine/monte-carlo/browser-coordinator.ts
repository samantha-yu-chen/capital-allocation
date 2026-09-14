import { runMonteCarloBrowserPool } from './browser-pool.js';
import type { CoordinatorReply, CoordinatorRequest } from './browser.js';
const scope = globalThis as unknown as { onmessage: (event: MessageEvent<CoordinatorRequest>) => void; postMessage: (reply: CoordinatorReply) => void };
scope.onmessage = async ({ data }) => {
  try {
    const result = await runMonteCarloBrowserPool(data.profile, { batchSize: data.batchSize, concurrency: data.concurrency,
      ...(data.ledgerOptions ? { ledgerOptions: data.ledgerOptions } : {}), onProgress: progress => scope.postMessage({ progress }) });
    scope.postMessage({ result });
  } catch (error) { scope.postMessage({ error: { name: error instanceof Error ? error.name : 'Error', message: String(error) } }); }
};
