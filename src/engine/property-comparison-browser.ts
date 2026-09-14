import type { Profile } from '../domain/contracts.js';
import type { LedgerOptions } from './ledger.js';
import type { PropertyComparison } from './property-comparison.js';
import type { SimulationProgress } from './monte-carlo/simulation.js';
export function comparePropertyPlansBrowser(profile:Profile,controls:{ledgerOptions:Partial<LedgerOptions>;signal:AbortSignal;onProgress:(p:SimulationProgress)=>void}):Promise<PropertyComparison>{
  return new Promise((resolve,reject)=>{
    if(controls.signal.aborted){reject(new DOMException('Comparison cancelled','AbortError'));return;}
    const worker=new Worker(new URL('./property-comparison.worker.ts',import.meta.url),{type:'module'});
    const finish=()=>{worker.terminate();controls.signal.removeEventListener('abort',cancel);};
    const cancel=()=>{finish();reject(new DOMException('Comparison cancelled','AbortError'));};
    controls.signal.addEventListener('abort',cancel,{once:true});
    worker.onerror=e=>{finish();reject(new Error(e.message));};
    worker.onmessage=event=>{
      if(event.data.type==='progress')controls.onProgress(event.data.progress);
      else {finish();if(event.data.type==='done')resolve(event.data.result as PropertyComparison);else reject(new Error(String(event.data.message)));}
    };
    worker.postMessage({profile,ledgerOptions:controls.ledgerOptions});
  });
}
