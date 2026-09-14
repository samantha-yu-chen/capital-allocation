import { availableParallelism, cpus } from 'node:os';
import { createExampleProfile } from '../../domain/fixtures.js';
import { runMonteCarloNode } from '../../engine/monte-carlo/node.js';
const profile = createExampleProfile();
const count = process.argv[2];
if (count !== undefined) profile.simulation.count = Number(count);
const concurrency = Number(process.argv[3] ?? Math.min(4, availableParallelism()));
const start = performance.now();
const result = await runMonteCarloNode(profile, { concurrency });
console.log(JSON.stringify({ runtime: { node: process.version, cpu: cpus()[0]?.model, availableCores: availableParallelism(),
  workers: concurrency, elapsedSeconds: (performance.now() - start) / 1000 },
  count: result.metadata.simulationCount, seed: result.metadata.seed, successProbability: result.successProbability,
  bridgeFailureProbability: result.bridgeFailureProbability, depletionProbability: result.depletionProbability,
  terminalWealthReal: result.terminalWealth, fireCapitalReal: result.fireCapital, sequenceRisk: result.sequenceRisk,
  diagnostics: result.diagnostics, versions: { engine: result.metadata.engineVersion, simulation: result.metadata.simulationVersion,
    generator: result.metadata.returnGeneratorVersion, tax: result.metadata.taxConfigVersion } }, null, 2));
