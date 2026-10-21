'use strict';
const {createHash}=require('node:crypto');
const EVIDENCE_RECEIPT_MEDIA='application/vnd.chunklab.evidence-delta+json';
const evidenceHash=events=>createHash('sha256').update(JSON.stringify(events)).digest('hex');
function receiptBase(accept){
  const match=/^application\/vnd\.chunklab\.evidence-delta\+json; base-seq=(0|[1-9][0-9]{0,15})$/.exec(accept||'');
  const value=match?Number(match[1]):null;return Number.isSafeInteger(value)?value:null;
}
function projectEvidence(result,base){
  if(base===null||base!==result.seq-1||result.operation?.entity!=='answer'||result.changes?.delta!==true||result.changes.seq!==result.seq)return result;
  const key=result.operation.key,stat=result.changes.mem?.stats?.bySentence?.[key],learning=stat?.learningV1,events=learning?.evidence;
  // Short histories already gzip very well; proof hashes would add overhead.
  if(!Array.isArray(events)||events.length<32||events.length>5000)return result;
  const added=events.filter(event=>event.id===result.operation.id);
  if(added.length!==1)return result;
  const original=JSON.stringify(events);if(Buffer.byteLength(original)>512*1024)return result;
  const before=events.filter(event=>event.id!==result.operation.id);
  const {evidence,...metadata}=learning;void evidence;
  const patched={...stat,learningV1:{...metadata,evidenceDelta:{version:1,hash:'sha256-json-v1',baseSeq:base,
    previousCount:before.length,previousHash:evidenceHash(before),nextCount:events.length,nextHash:evidenceHash(events),append:added}}};
  if(Buffer.byteLength(JSON.stringify(patched))>=Buffer.byteLength(JSON.stringify(stat)))return result;
  return{...result,changes:{...result.changes,mem:{...result.changes.mem,stats:{...result.changes.mem.stats,
    bySentence:{...result.changes.mem.stats.bySentence,[key]:patched}}}}};
}
module.exports={EVIDENCE_RECEIPT_MEDIA,receiptBase,projectEvidence,evidenceHash};
