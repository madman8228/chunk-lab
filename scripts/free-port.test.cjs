'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('e2e/lib/free-port.js','utf8'),context={module:{exports:{}},process:{platform:'win32'},Math:Object.assign(Object.create(Math),{random:()=>0}),require:name=>{assert.equal(name,'child_process');return {execSync:command=>command.startsWith('netstat')?[
 '  TCP    127.0.0.1:12300      0.0.0.0:0       LISTENING     1',
 '  TCP    192.168.1.2:12301    111.31.241.198:443 ESTABLISHED 2',
 '  TCP    [::1]:12302          [::1]:443      TIME_WAIT     0',
 '  UDP    0.0.0.0:12303        *:*                         3',
 '  TCP    127.0.0.1:12304      127.0.0.1:443  CLOSE_WAIT    4'
 ].join('\n'):'Start Port End Port\n12305 12306\n'};}};
vm.runInNewContext(source,context);const ports=context.module.exports;
assert.equal(ports.freePort(12300,10),12307,'Windows outbound connections can prevent an otherwise non-listening port from binding');
for(const port of [12300,12301,12302,12303,12304])assert.ok(ports.usedPorts().has(port));assert.equal(ports.usedPorts().has(443),false,'remote endpoints are not local port allocations');
console.log('Test port selection: local TCP states, UDP, IPv6, excluded ranges and remote/local distinction passed.');
