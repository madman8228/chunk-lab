import core from './core.cjs';
import draftModel from '../../js/wordbook-draft.js';
import engine from '../../landing/sentence-cloze-engine.js';
import contract from '../../js/vocabulary-course-contract.js';
import applicationModel from '../../js/vocabulary-application-material.js';

function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value;}
async function prepare(library,teachingPlans=[]){
 const snapshot=structuredClone(library),cache=new Map(),strings=new Set();
 if(snapshot&&typeof snapshot==='object'){const {revision,...body}=snapshot;strings.add(JSON.stringify(canonical(body)));}
 for(const key of ['sources','senses','activities','applications','courses'])if(Array.isArray(snapshot?.[key]))for(const row of snapshot[key]){
  if(row&&typeof row==='object'){const {revision,...body}=row;strings.add(JSON.stringify(canonical(body)));if(key==='activities'&&row.guidedSteps!==undefined)strings.add(JSON.stringify(row.guidedSteps));}
 }
 for(const plan of Array.isArray(teachingPlans)?teachingPlans:[])if(plan&&typeof plan==='object'){const {revision,...body}=plan;strings.add(JSON.stringify(canonical(body)));}
 for(const text of strings){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));cache.set(text,Array.from(new Uint8Array(bytes),value=>value.toString(16).padStart(2,'0')).join(''));}
 const model=core.createModel({hash:text=>{if(!cache.has(text))throw Error('材料校验快照已变化，请重新读取');return cache.get(text);},draftModel,engine,contract,applicationModel});
 return {snapshot,model};
}
window.VocabularyMaterialLibrary={
 async validate(library){const {snapshot,model}=await prepare(library);model.validate(snapshot);return snapshot;},
 async previewCourse(library,courseId){const {snapshot,model}=await prepare(library);return model.previewCourse(snapshot,courseId);},
 async prepareDraft(input){const source=structuredClone(input),{snapshot,model}=await prepare(source.library,source.teachingPlans);source.library=snapshot;return model.prepareDraft(source);}
};
