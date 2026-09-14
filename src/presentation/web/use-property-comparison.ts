import { useCallback, useEffect, useRef, useState } from 'react';
import type { Profile } from '../../domain/contracts.js';
import type { LedgerOptions } from '../../engine/ledger.js';
import type { PropertyComparison } from '../../engine/property-comparison.js';
import { comparePropertyPlansBrowser } from '../../engine/property-comparison-browser.js';
export function usePropertyComparison(key:string|null){
  const [state,setState]=useState<{status:'idle'|'running'|'done'|'cancelled'|'error';completed:number;total:number;result:PropertyComparison|null;message:string}>({status:'idle',completed:0,total:0,result:null,message:''});
  const token=useRef(0),controller=useRef<AbortController|null>(null);
  useEffect(()=>{token.current++;controller.current?.abort();setState({status:'idle',completed:0,total:0,result:null,message:''});},[key]);
  useEffect(()=>()=>controller.current?.abort(),[]);
  const run=useCallback((profile:Profile,ledgerOptions:Partial<LedgerOptions>)=>{
    controller.current?.abort();const mine=++token.current,abort=new AbortController();controller.current=abort;
    setState({status:'running',completed:0,total:profile.simulation.count,result:null,message:''});
    void comparePropertyPlansBrowser(profile,{ledgerOptions,signal:abort.signal,onProgress:p=>{
      if(mine===token.current)setState(s=>({...s,completed:p.completed,total:p.total}));
    }}).then(result=>{if(mine===token.current)setState(s=>({...s,status:'done',result}));},(error:unknown)=>{
      if(mine!==token.current)return;const e=error instanceof Error?error:new Error(String(error));
      setState(s=>({...s,status:e.name==='AbortError'?'cancelled':'error',message:e.message,result:null}));
    });
  },[]);
  return {state,run,cancel:()=>controller.current?.abort()};
}
