import assert from 'node:assert/strict';
import { filterResources, selectionFromUrl } from './facets.mjs';

const resources = [
  {resourceId:'nce',kind:'course',title:'新概念英语 1',facets:{}},
  {resourceId:'nce-series',kind:'wordbook',title:'第一册词汇',facets:{seriesId:'new-concept'}},
  {resourceId:'school',kind:'wordbook',title:'同步词汇',facets:{seriesId:'人教版英语',schoolStages:['初中'],grades:['九年级']}},
  {resourceId:'primary',kind:'textbook',title:'小学英语',facets:{schoolStages:['小学'],grades:['三年级']}},
  {resourceId:'other',kind:'course',title:'初中生日常口语',facets:{schoolStages:['初中']}}
];
const ids = query => filterResources(resources,selectionFromUrl(query)).map(row=>row.resourceId);
assert.deepEqual(ids('?category=new-concept'),['nce','nce-series']);
assert.deepEqual(ids('?category=school'),['primary']);
assert.deepEqual(ids('?category=school&schoolStages=初中&grades=九年级'),['school']);
assert.deepEqual(ids('?category=school&schoolStages=初中&grades=七年级'),[]);
assert.deepEqual(ids('?category=new-concept&q=词汇'),['nce-series']);
assert.deepEqual(ids('?category=practical'),['other']);
assert.deepEqual(ids('?kind=textbook'),['primary']);
assert.deepEqual(selectionFromUrl('?category=school').schoolStages,['小学']);
assert.deepEqual(filterResources([{resourceId:'one',kind:'course',title:'新概念',facets:{volume:'第一册'}},{resourceId:'two',kind:'course',title:'新概念',facets:{volume:'第二册'}}],selectionFromUrl('?category=new-concept&volume=第一册')).map(row=>row.resourceId),['one']);
const practical = [
  {resourceId:'oral',kind:'course',title:'口语3000句',facets:{}},
  {resourceId:'travel',kind:'course',title:'旅行英语',facets:{}},
  {resourceId:'business',kind:'course',title:'沟通课程',facets:{topics:['商务职场']}},
  {resourceId:'classics',kind:'course',title:'经典教材精讲',facets:{}},
  {resourceId:'stories',kind:'course',title:'阅读课',facets:{},sourceRefs:[{type:'story-package',id:'story'}]}
];
for (const [topic,id] of Object.entries({daily:'oral',travel:'travel',business:'business',classics:'classics',stories:'stories'})) {
  assert.deepEqual(filterResources(practical,selectionFromUrl('?category=practical&practicalTopic='+topic)).map(row=>row.resourceId),[id]);
}
assert.equal(selectionFromUrl('?category=school&practicalTopic=daily').practicalTopic,'');
const wordbooks = [
  {resourceId:'basic',kind:'wordbook',title:'入门',facets:{goals:['基础必备']}},
  {resourceId:'exam',kind:'wordbook',title:'词汇',facets:{exams:['中考']}},
  {resourceId:'college',kind:'wordbook',title:'词汇',facets:{exams:['CET-4']}},
  {resourceId:'untagged',kind:'wordbook',title:'中考词汇',facets:{}}
];
assert.equal(filterResources(wordbooks,selectionFromUrl('?kind=wordbook')).length,4);
for (const [category,id] of Object.entries({basic:'basic',zhongkao:'exam',college:'college'})) {
  assert.deepEqual(filterResources(wordbooks,selectionFromUrl('?kind=wordbook&wordbookCategory='+category)).map(row=>row.resourceId),[id]);
}
assert.equal(selectionFromUrl('?category=school&wordbookCategory=basic').wordbookCategory,'');
assert.equal(selectionFromUrl('?kind=wordbook&wordbookCategory=invalid').wordbookCategory,'');
console.log('Discovery category and school grade filtering passed');
