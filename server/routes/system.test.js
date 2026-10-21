'use strict';
const assert=require('node:assert/strict');
const express=require('express');
const {registerSystemRoutes}=require('./system');
const app=express();
registerSystemRoutes({app,auth:{REQUIRE_AUTH:true,authenticate:(_req,_res,next)=>next()},
  metrics:{},aiEnabled:false,touchUserActivity(){},writeProtocol:3});
(async()=>{
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const originalPhone=process.env.PHONE_AUTH_ENABLED;
  const originalLegacy=process.env.ALLOW_LEGACY_PASSWORD_LOGIN;
  try{
    for(const [phone,legacy,expected] of [['true','true',true],['true','false',false],['true',undefined,false],['false','true',false]]){
      process.env.PHONE_AUTH_ENABLED=phone;
      if(legacy===undefined)delete process.env.ALLOW_LEGACY_PASSWORD_LOGIN;
      else process.env.ALLOW_LEGACY_PASSWORD_LOGIN=legacy;
      const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/config');
      assert.equal(response.status,200);
      const config=await response.json();
      assert.equal(config.legacyPasswordLoginAllowed,expected);
      assert.equal(config.requireAuth,true);
      assert.equal(config.writeProtocol,3);
    }
    console.log('system config: explicit legacy transition flag verified');
  }finally{
    if(originalPhone===undefined)delete process.env.PHONE_AUTH_ENABLED;else process.env.PHONE_AUTH_ENABLED=originalPhone;
    if(originalLegacy===undefined)delete process.env.ALLOW_LEGACY_PASSWORD_LOGIN;else process.env.ALLOW_LEGACY_PASSWORD_LOGIN=originalLegacy;
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
