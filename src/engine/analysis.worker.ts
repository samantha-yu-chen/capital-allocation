import { compareMarginal } from './marginal.js';
/**
 * Coordinator worker for the reverse solvers and the FIRE age curve.
 *
 * Each candidate plan is a complete Monte Carlo run, executed through the existing simulation
 * worker pool, so the configured path count is never reduced to make a search finish sooner.
 */
import { runMonteCarloBrowserPool } from './monte-carlo/browser-pool.js';
import { fireAgeCurve } from './fire-curve.js';
import { runSolver, type EvaluateProfile } from './solver.js';
import type { AnalysisReply, AnalysisRequest, AnalysisTransport } from './analysis-browser.js';

const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<AnalysisRequest>) => void;
  postMessage: (reply: AnalysisReply) => void;
};

const poolEvaluator = (transport: AnalysisTransport): EvaluateProfile => (profile, controls) =>
  runMonteCarloBrowserPool(profile, {
    ledgerOptions: controls.ledgerOptions,
    concurrency: transport.concurrency,
    batchSize: transport.batchSize,
    ...(controls.signal ? { signal: controls.signal } : {}),
    ...(controls.onProgress ? { onProgress: controls.onProgress } : {}),
  });

scope.onmessage = async ({ data }) => {
  try {
    const evaluate = poolEvaluator(data.transport);
    if (data.kind === 'marginal') {
      const result = await compareMarginal(data.profile, data.request, { evaluate,
        onProgress: progress => scope.postMessage({ type: 'marginal-progress', progress }) });
      scope.postMessage({ type: 'marginal-done', result });
    } else if (data.kind === 'solver') {
      const result = await runSolver(data.profile, data.request, {
        evaluate, includeSensitivity: data.includeSensitivity,
        onProgress: progress => scope.postMessage({ type: 'solver-progress', progress }),
      });
      scope.postMessage({ type: 'solver-done', result });
    } else {
      const result = await fireAgeCurve(data.profile, data.request, {
        evaluate, onProgress: progress => scope.postMessage({ type: 'curve-progress', progress }),
      });
      scope.postMessage({ type: 'curve-done', result });
    }
  } catch (error) {
    scope.postMessage({
      type: 'error', name: error instanceof Error ? error.name : 'Error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
