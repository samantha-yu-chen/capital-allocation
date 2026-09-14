import { abortIfNeeded } from './simulation.js';
import type { SimulationBatch, SimulationControls, SimulationRequest } from './simulation.js';
export type WorkerReply = { result: SimulationBatch } | { error: { name: string; message: string } };
export interface BatchWorker {
  post(request: SimulationRequest): void;
  listen(reply: (message: WorkerReply) => void, error: (error: Error) => void): void;
  terminate(): void;
}
/** Transport-independent fixed pool. One in-flight batch per worker; abort terminates the entire pool. */
export function createWorkerPool(size: number, factory: () => BatchWorker) {
  if (!Number.isInteger(size) || size < 1 || size > 64) throw new RangeError('Worker count must be 1–64');
  const slots: { worker: BatchWorker; busy: boolean }[] = [];
  const pending = new Set<(error: Error) => void>();
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    for (const slot of slots) slot.worker.terminate();
    for (const reject of [...pending]) reject(new DOMException('Worker pool closed', 'AbortError'));
  };
  try { for (let i = 0; i < size; i++) slots.push({ worker: factory(), busy: false }); }
  catch (error) { close(); throw error; }
  const executeBatch: NonNullable<SimulationControls['executeBatch']> = (request, signal) => new Promise((resolve, reject) => {
    abortIfNeeded(signal);
    if (closed) throw new Error('Worker pool is closed');
    const slot = slots.find(s => !s.busy);
    if (!slot) throw new Error('Concurrency exceeds worker pool size');
    slot.busy = true;
    const cleanup = () => { slot.busy = false; pending.delete(fail); signal?.removeEventListener('abort', abort); };
    const fail = (error: Error) => { cleanup(); reject(error); };
    const abort = () => close();
    pending.add(fail);
    signal?.addEventListener('abort', abort, { once: true });
    slot.worker.listen(message => {
      if ('error' in message) { const error = new Error(message.error.message); error.name = message.error.name; fail(error); }
      else { cleanup(); resolve(message.result); }
    }, fail);
    try { slot.worker.post(request); } catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
  });
  return { executeBatch, close };
}
