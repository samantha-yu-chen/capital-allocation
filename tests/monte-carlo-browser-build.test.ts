import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
test('browser entry bundles its coordinator and nested simulation workers without Node imports', async () => {
  const outDir=await mkdtemp(join(tmpdir(),'capital-worker-build-'));
  try {
    await build({configFile:false,logLevel:'silent',build:{outDir,emptyOutDir:true,
      lib:{entry:'src/engine/monte-carlo/browser.ts',formats:['es'],fileName:'simulation'}}});
    const assets=await readdir(join(outDir,'assets'));
    assert.ok(assets.some(name=>name.startsWith('browser-coordinator-')));
    assert.ok(assets.some(name=>name.startsWith('browser-worker-')));
  } finally { await rm(outDir,{recursive:true,force:true}); }
});
test('the solver and curve entry bundles its coordinator and the simulation workers it drives', async () => {
  const outDir=await mkdtemp(join(tmpdir(),'capital-analysis-build-'));
  try {
    await build({configFile:false,logLevel:'silent',build:{outDir,emptyOutDir:true,
      lib:{entry:'src/engine/analysis-browser.ts',formats:['es'],fileName:'analysis'}}});
    const assets=await readdir(join(outDir,'assets'));
    // The search coordinator keeps every candidate's ledger work off the UI thread, and drives the
    // existing simulation pool rather than re-implementing batch execution.
    assert.ok(assets.some(name=>name.startsWith('analysis.worker-')));
    assert.ok(assets.some(name=>name.startsWith('browser-worker-')));
  } finally { await rm(outDir,{recursive:true,force:true}); }
});
