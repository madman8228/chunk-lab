import test from 'node:test';
import assert from 'node:assert/strict';
import { composePrompt } from './model.mjs';
test('external conversation owns inputs while website retains bounded output contract',()=>{
 const prompt=composePrompt({requestId:'request-fixture',baseFingerprint:'fingerprint-fixture',settings:{dialogue:true,batchCount:20,level:''}}, {book:{title:'',units:[]},items:[]});
 assert.ok(prompt.includes('直接上传或粘贴到本次外部 AI 对话'));
 assert.ok(prompt.includes('难度和数量在本次对话中确认'));
 assert.ok(prompt.includes('每批硬上限 20'));
 assert.ok(prompt.includes('册次、单元和来源页码'));
 assert.ok(prompt.includes('request-fixture'));
 assert.ok(prompt.includes('fingerprint-fixture'));
 assert.ok(!prompt.includes('网站已选择：'));
});
