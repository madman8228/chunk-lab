'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createOfflineLicense,WEEK}=require('./offline-license');
(async()=>{
 const keys=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1',publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 const now=1792700000000,service=createOfflineLicense({...keys,now:()=>now});
 const scope={accountId:'fixture-user',service:'https://fixture.test',courseId:'course',unitId:'unit',contentVersion:'v1',sha256:'a'.repeat(64)};
 const signed=service.issue(scope,{allowed:true,mode:'member',endsAt:now+WEEK*2});
 assert.equal(JSON.parse(Buffer.from(signed.payload,'base64url')).expiresAt,now+WEEK);
 const key=await crypto.webcrypto.subtle.importKey('jwk',service.publicJwk(),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 assert.ok(await crypto.webcrypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,Buffer.from(signed.signature,'base64url'),Buffer.from(signed.payload)));
 assert.equal(await crypto.webcrypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,Buffer.from(signed.signature,'base64url'),Buffer.from(signed.payload+'x')),false);
 assert.equal(JSON.parse(Buffer.from(service.issue(scope,{allowed:true,mode:'member',endsAt:now+1000}).payload,'base64url')).expiresAt,now+1000);
 assert.equal(JSON.parse(Buffer.from(service.issue(scope,{allowed:true,mode:'free'}).payload,'base64url')).expiresAt,null);
 for(const decision of [{allowed:true,mode:'trial'},{allowed:false,mode:'member'},{allowed:true,mode:'member',endsAt:now}])assert.throws(()=>service.issue(scope,decision));
 console.log('Offline license: WebCrypto signature, tamper rejection, seven-day cap, membership expiry, free and trial boundaries passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
