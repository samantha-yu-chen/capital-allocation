import test from 'node:test';
import assert from 'node:assert/strict';
import { createExampleProfile } from '../src/domain/fixtures.js';
import { ASSETS, ParametricReturnGenerator, cholesky } from '../src/engine/monte-carlo/generator.js';
import { deterministicPath, runDeterministicProjection, runProjection } from '../src/engine/index.js';
const generator = new ParametricReturnGenerator();
const input = () => ({ years: 64, seed: 421337, pathIndex: 0, assumptions: createExampleProfile().market });

test('seeded paths repeat, differ across indices/seeds and retain prefixes when horizon changes', () => {
  const a = input();
  assert.deepEqual(generator.generatePath(a), generator.generatePath(a));
  assert.notDeepEqual(generator.generatePath(a).years, generator.generatePath({ ...a, pathIndex: 1 }).years);
  assert.notDeepEqual(generator.generatePath(a).years, generator.generatePath({ ...a, seed: 42 }).years);
  assert.deepEqual(generator.generatePath({ ...a, years: 100 }).years.slice(0, 64), generator.generatePath(a).years);
});
test('zero volatility exactly matches mean path and deterministic accounting', () => {
  const p = createExampleProfile();
  ASSETS.forEach(key => { p.market[key].volatility = 0; });
  const path = generator.generatePath({ ...input(), assumptions: p.market });
  assert.deepEqual(path.years, deterministicPath(64, p.market).years);
  const sampled = runProjection(p, path), deterministic = runDeterministicProjection(p);
  assert.deepEqual(sampled.years, deterministic.years);
  assert.deepEqual(sampled.metrics, deterministic.metrics);
});
test('shocks do not shift when other assets become deterministic or their means change', () => {
  const a = input(), baseline = generator.generatePath(a);
  a.assumptions.equities.volatility = 0; a.assumptions.equities.meanNominal = .3;
  const changed = generator.generatePath(a);
  assert.deepEqual(changed.years.map(y => y.bonds), baseline.years.map(y => y.bonds));
});
test('sample arithmetic means and standard deviations match all five configured moments', () => {
  // 100,000 independent annual draws. 0.003 absolute tolerance exceeds 6 SE for these moments.
  const a = input(); a.years = 100_000;
  ASSETS.forEach(key => { a.assumptions[key].volatility = key === 'equities' ? .15 : .06; });
  const years = generator.generatePath(a).years;
  for (const key of ASSETS) {
    const values = years.map(y => y[key]);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    const config = a.assumptions[key], expected = 'mean' in config ? config.mean : config.meanNominal;
    assert.ok(Math.abs(mean - expected) < .003, `${key} mean ${mean}`);
    assert.ok(Math.abs(sd - config.volatility) < .003, `${key} sd ${sd}`);
    assert.ok(values.every(v => v > -1 && Number.isFinite(v)));
  }
});
test('configured Gaussian log-growth correlation appears in samples', () => {
  const a = input(); a.years = 100_000;
  a.assumptions.correlation = Array.from({ length: 5 }, (_, i) => Array.from({ length: 5 }, (_, j) => i === j ? 1 : 0));
  a.assumptions.correlation[0]![1] = a.assumptions.correlation[1]![0] = -.65;
  const years = generator.generatePath(a).years;
  const x = years.map(y => Math.log1p(y.equities)), y = years.map(y => Math.log1p(y.bonds));
  const mx = x.reduce((s,v) => s+v,0)/x.length, my = y.reduce((s,v) => s+v,0)/y.length;
  let cov = 0, vx = 0, vy = 0;
  x.forEach((v,i) => { cov += (v-mx)*(y[i]!-my); vx += (v-mx)**2; vy += (y[i]!-my)**2; });
  assert.ok(Math.abs(cov/Math.sqrt(vx*vy) + .65) < .012); // >6 SE
});
test('singular correlation is supported; asymmetric, indefinite and malformed matrices reject', () => {
  assert.doesNotThrow(() => cholesky(Array.from({length:5}, () => Array(5).fill(1))));
  const a = input(); a.assumptions.correlation[0]![1] = .99;
  assert.throws(() => generator.generatePath(a));
  assert.throws(() => cholesky([[1]]));
  const m = Array.from({length:5}, (_,i) => Array.from({length:5}, (_,j) => i===j ? 1 : -.9));
  assert.throws(() => cholesky(m));
});
test('invalid generator inputs fail explicitly', () => {
  assert.throws(() => generator.generatePath({ ...input(), seed: -1 }));
  assert.throws(() => generator.generatePath({ ...input(), pathIndex: 1.5 }));
  assert.throws(() => generator.generatePath({ ...input(), years: -1 }));
});
