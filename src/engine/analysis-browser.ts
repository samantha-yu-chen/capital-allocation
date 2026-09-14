import type { MarginalRequest, MarginalResult, MarginalProgress } from './marginal.js';
/**
 * Browser transport for the reverse solvers and the FIRE age curve.
 *
 * Both analyses run many full simulations in sequence, so the whole search lives in one coordinator
 * worker, which drives the existing Monte Carlo worker pool for each candidate. The UI thread only
 * receives progress and a final result: no search arithmetic, no aggregation and no ledger work
 * happens on it. A cancelled run terminates the coordinator and rejects — it never resolves with a
 * partial curve or a half-searched answer.
 */
import type { Profile } from '../domain/contracts.js';
import type { LedgerOptions } from './ledger.js';
import type { FireAgeCurveProgress, FireAgeCurveRequest, FireAgeCurveResult } from './fire-curve.js';
import type { SolverProgress, SolverRequest, SolverRun } from './solver.js';

export interface AnalysisTransport { concurrency: number; batchSize: number }

export type AnalysisRequest =
  | { kind: 'marginal'; profile: Profile; request: MarginalRequest; transport: AnalysisTransport }
  | { kind: 'solver'; profile: Profile; request: SolverRequest; includeSensitivity: boolean; transport: AnalysisTransport }
  | { kind: 'curve'; profile: Profile; request: FireAgeCurveRequest; transport: AnalysisTransport };

export type AnalysisReply =
  | { type: 'marginal-progress'; progress: MarginalProgress }
  | { type: 'marginal-done'; result: MarginalResult }
  | { type: 'solver-progress'; progress: SolverProgress }
  | { type: 'curve-progress'; progress: FireAgeCurveProgress }
  | { type: 'solver-done'; result: SolverRun }
  | { type: 'curve-done'; result: FireAgeCurveResult }
  | { type: 'error'; name: string; message: string };

interface Controls<P> { signal: AbortSignal; onProgress: (progress: P) => void; transport?: AnalysisTransport }

const defaultTransport = (): AnalysisTransport => ({
  concurrency: Math.min(4, Math.max(1,
    (globalThis as { navigator?: { hardwareConcurrency?: number } }).navigator?.hardwareConcurrency || 1)),
  batchSize: 100,
});

function runInWorker<P, R>(request: AnalysisRequest, controls: Controls<P>, done: AnalysisReply['type'], progress: AnalysisReply['type']): Promise<R> {
  return new Promise<R>((resolve, reject) => {
    if (controls.signal.aborted) { reject(new DOMException('Analysis cancelled', 'AbortError')); return; }
    const worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => { controls.signal.removeEventListener('abort', cancel); worker.terminate(); };
    const fail = (error: Error) => { cleanup(); reject(error); };
    function cancel(): void { fail(new DOMException('Analysis cancelled', 'AbortError')); }
    controls.signal.addEventListener('abort', cancel, { once: true });
    worker.onmessage = ({ data }: MessageEvent<AnalysisReply>) => {
      if (data.type === progress) { controls.onProgress((data as unknown as { progress: P }).progress); return; }
      if (data.type === 'error') { const error = new Error(data.message); error.name = data.name; fail(error); return; }
      if (data.type === done) { cleanup(); resolve((data as unknown as { result: R }).result); return; }
      fail(new Error(`Unexpected analysis reply ${data.type}`));
    };
    worker.onerror = event => fail(new Error(event.message));
    worker.onmessageerror = () => fail(new Error('Could not decode the analysis reply'));
    try { worker.postMessage(request); } catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
  });
}

export function runSolverBrowser(
  profile: Profile, request: SolverRequest,
  controls: Controls<SolverProgress> & { includeSensitivity: boolean; ledgerOptions?: Partial<LedgerOptions> },
): Promise<SolverRun> {
  return runInWorker<SolverProgress, SolverRun>({
    kind: 'solver', profile, includeSensitivity: controls.includeSensitivity,
    request: controls.ledgerOptions ? { ...request, ledgerOptions: controls.ledgerOptions } : request,
    transport: controls.transport ?? defaultTransport(),
  }, controls, 'solver-done', 'solver-progress');
}

export function fireAgeCurveBrowser(
  profile: Profile, request: FireAgeCurveRequest,
  controls: Controls<FireAgeCurveProgress> & { ledgerOptions?: Partial<LedgerOptions> },
): Promise<FireAgeCurveResult> {
  return runInWorker<FireAgeCurveProgress, FireAgeCurveResult>({
    kind: 'curve', profile,
    request: controls.ledgerOptions ? { ...request, ledgerOptions: controls.ledgerOptions } : request,
    transport: controls.transport ?? defaultTransport(),
  }, controls, 'curve-done', 'curve-progress');
}

export function compareMarginalBrowser(profile: Profile, request: MarginalRequest, controls: Controls<MarginalProgress>): Promise<MarginalResult> {
  return runInWorker<MarginalProgress, MarginalResult>({ kind: 'marginal', profile, request,
    transport: controls.transport ?? defaultTransport() }, controls, 'marginal-done', 'marginal-progress');
}
