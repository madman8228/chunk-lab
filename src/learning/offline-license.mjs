const WEEK=7*24*60*60*1000;
const reject=()=>{throw Object.assign(new Error('离线许可无法确认，请联网后重试；原学习记录保留。'),{code:'INVALID_OFFLINE_LICENSE'});};
function decode(value){
  if(typeof value!=='string'||!value||value.length>16384||!/^[A-Za-z0-9_-]+$/.test(value))return reject();
  return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
}

// publicKey must come from the previously confirmed server, never from the cached package.
export async function verifyOfflineLicense({license,publicKey,scope,body,now=Date.now(),lastConfirmedTime=0,subtle=crypto.subtle}){
  try{
    if(!Number.isSafeInteger(now)||!Number.isSafeInteger(lastConfirmedTime)||now<lastConfirmedTime)return reject();
    const key=await subtle.importKey('jwk',publicKey,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
    if(!await subtle.verify({name:'ECDSA',hash:'SHA-256'},key,decode(license.signature),new TextEncoder().encode(license.payload)))return reject();
    const claims=JSON.parse(new TextDecoder().decode(decode(license.payload)));
    if(claims.version!==1||!Number.isSafeInteger(claims.issuedAt)||claims.issuedAt>now)return reject();
    for(const field of ['accountId','service','courseId','unitId','contentVersion'])if(typeof scope[field]!=='string'||!scope[field]||claims[field]!==scope[field])return reject();
    if(claims.mode==='member'){
      if(!Number.isSafeInteger(claims.expiresAt)||claims.expiresAt<=now||claims.expiresAt<=claims.issuedAt||claims.expiresAt-claims.issuedAt>WEEK)return reject();
    }else if(claims.mode!=='free'||claims.expiresAt!==null)return reject();
    if(!(body instanceof Uint8Array))return reject();
    const digest=Array.from(new Uint8Array(await subtle.digest('SHA-256',body)),b=>b.toString(16).padStart(2,'0')).join('');
    if(digest!==claims.sha256)return reject();
    return claims;
  }catch(_){return reject();}
}
