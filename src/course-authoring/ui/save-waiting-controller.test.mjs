import assert from 'node:assert/strict';
import { AuthoringController } from './controller.mjs';
const original = Object.fromEntries(['location','history','ServerStore','addEventListener','setTimeout','clearTimeout'].map(k=>[k,globalThis[k]]));
try {
  const missingCallback=()=>{throw new Error('Expected callback was not registered');};
  let timeout=missingCallback, stateListener=missingCallback, exports=0, saves=0;
  /** @type {(value: unknown) => void} */
  let releaseSave=(_value)=>missingCallback();
  const listeners={}, renders=[];
  const snapshot={sessionId:'synthetic-only',stage:'preview',preferences:{},identity:{}};
  const root={addEventListener:(k,fn)=>listeners[k]=fn,querySelector:()=>null};
  let syncError='';
  Reflect.set(globalThis,'location',{search:'?session=synthetic-only'});
  globalThis.ServerStore={state:()=>({error:syncError}),onState:fn=>{stateListener=fn;return ()=>{};}};
  globalThis.addEventListener=()=>{};
  Reflect.set(globalThis,'setTimeout',fn=>{timeout=fn;return 1;}); globalThis.clearTimeout=()=>{};
  const service={open:async()=>snapshot,codec:{parseText:()=>({ok:false})},capabilityCatalog:{describeCreationOptions:()=>[]},
    save:async()=>{saves++;return new Promise(resolve=>releaseSave=resolve);},exportCourse:async()=>{exports++;}};
  const controller=new AuthoringController({root,view:{render:(s,o)=>renders.push({stage:s.stage,...o})},service,sessionRepository:{},scopeGuard:{},io:{}});
  await controller.start();
  const click=action=>listeners.click({target:{closest:()=>({dataset:{action}})}});
  const pending=click('save');
  await Promise.resolve(); await Promise.resolve();
  timeout(); await Promise.resolve();
  assert.equal(renders.at(-1).saveDelayed,true);
  syncError='SERVER_SEQ_ROLLBACK';stateListener();await Promise.resolve();
  assert.equal(renders.at(-1).synchronizationError,'SERVER_SEQ_ROLLBACK');
  await click('save');assert.equal(saves,1,'waiting must not permit duplicate submission');
  await click('export');assert.equal(exports,1,'export remains usable while waiting');
  assert.equal(controller.busy,true);
  releaseSave({...snapshot,stage:'saved'});await pending;
  assert.equal(controller.busy,false);
  assert.equal(renders.at(-1).stage,'saved');
  assert.equal(renders.at(-1).saveDelayed,false);
  console.log('save waiting controller: timeout, sync error, export, duplicate prevention and late confirmation passed');
} finally {for(const [key,value]of Object.entries(original)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
