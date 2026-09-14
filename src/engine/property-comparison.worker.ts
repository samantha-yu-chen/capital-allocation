import { comparePropertyPlans } from './property-comparison.js';
self.onmessage=async(event:MessageEvent)=>{
  const {profile,ledgerOptions}=event.data as unknown as {profile:Parameters<typeof comparePropertyPlans>[0];ledgerOptions:NonNullable<Parameters<typeof comparePropertyPlans>[1]>['ledgerOptions']};
  try {
    const result=await comparePropertyPlans(profile,{...(ledgerOptions?{ledgerOptions}:{}),onProgress:progress=>self.postMessage({type:'progress',progress})});
    self.postMessage({type:'done',result});
  } catch(error){self.postMessage({type:'error',message:error instanceof Error?error.message:String(error)});}
};
