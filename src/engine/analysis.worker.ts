import { runAttribution } from './attribution.js';
import { compareMarginal } from './marginal.js';
/**
 * Coordinator worker for the reverse solvers and the FIRE age curve.
 *
 * Each candidate plan is a complete Monte Carlo run, executed through the existing simulation
 * worker pool, so the configured path count is never reduced to make a search finish sooner.
 */
import { createBrowserSimulationPool, runMonteCarloBrowserPool, type BrowserSimulationPool } from './monte-carlo/browser-pool.js';
import { fireAgeCurve } from './fire-curve.js';
import { runSolver, type EvaluateProfile } from './solver.js';
import { memoryScenarioCache, runScenarioBatch } from './scenario.js';
import type { AnalysisReply, AnalysisRequest, AnalysisTransport } from './analysis-browser.js';

const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<AnalysisRequest>) => void;
  postMessage: (reply: AnalysisReply) => void;
};

/**
 * One cache per coordinator instance.
 *
 * The screen creates a coordinator per run, so this reuses identical cells inside one batch — for
 * example the repeated ISA Heavy plan when only the spending axis moved a cell it does not touch.
 * It is keyed on the complete versioned inputs, so it can never return a cell computed for
 * different inputs.
 */
const cache = memoryScenarioCache();

const poolEvaluator = (transport: AnalysisTransport, shared?: BrowserSimulationPool): EvaluateProfile => (profile, controls) =>
  runMonteCarloBrowserPool(profile, {
    ledgerOptions: controls.ledgerOptions,
    concurrency: transport.concurrency,
    batchSize: transport.batchSize,
    ...(shared ? { pool: shared } : {}),
    ...(controls.signal ? { signal: controls.signal } : {}),
    ...(controls.onProgress ? { onProgress: controls.onProgress } : {}),
  });

scope.onmessage = async ({ data }) => {
  try {
    const evaluate = poolEvaluator(data.transport);
    if (data.kind === 'attribution') {
      const pool = createBrowserSimulationPool(data.transport.concurrency);
      try {
        const result = await runAttribution(data.profile, data.request, {cache: new Map(), evaluate: poolEvaluator(data.transport, pool),
          onProgress: progress => scope.postMessage({type: 'attribution-progress', progress})});
        scope.postMessage({type: 'attribution-done', result});
      } finally { pool.close(); }
    } else if (data.kind === 'marginal') {
      const result = await compareMarginal(data.profile, data.request, { evaluate,
        onProgress: progress => scope.postMessage({ type: 'marginal-progress', progress }) });
      scope.postMessage({ type: 'marginal-done', result });
    } else if (data.kind === 'scenarios') {
      // A batch runs one complete simulation per cell, so it keeps one worker set for all of them
      // rather than reloading the module graph tens of times.
      const pool = createBrowserSimulationPool(data.transport.concurrency);
      try {
        const result = await runScenarioBatch(data.profile, data.request, { cache,
          evaluate: poolEvaluator(data.transport, pool),
          onProgress: progress => scope.postMessage({ type: 'scenarios-progress', progress }) });
        scope.postMessage({ type: 'scenarios-done', result });
      } finally { pool.close(); }
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
