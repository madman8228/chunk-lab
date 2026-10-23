import assert from 'node:assert/strict';
import { textbookFacets, textbookBookId } from './textbook-profile.mjs';
import { filterResources, facetOptions } from '../learning-workspace/facets.mjs';

// Classification fixtures, not real textbook content or verified editions.
const base = {schoolStage:'小学',publisherId:'测试出版社',seriesId:'test-pep-3start-6years',edition:'测试版A',grade:'三年级',volume:'上册'};
const variants = [base,{...base,seriesId:'test-other-series'},{...base,grade:'四年级'},{...base,volume:'下册'},{...base,edition:'测试版B'}];
const ids = await Promise.all(variants.map(textbookBookId));
assert.equal(new Set(ids).size, variants.length, 'same grade, different series/edition/volume cannot overwrite one another');
assert.equal(await textbookBookId({...base}),ids[0]);
assert.equal(await textbookBookId({...base,textbookVersion:'测试教材版'}),ids[0],'adding a display label must not allocate a new course identity');
assert.equal(textbookFacets({...base,textbookVersion:'测试教材版'}).textbookVersion,'测试教材版');
assert.throws(()=>textbookFacets({...base,textbookVersion:''}));
const resources = variants.map((profile,index)=>({resourceId:ids[index],kind:'wordbook',facets:textbookFacets(profile)}));
const selected={schoolStages:['小学'],seriesId:[base.seriesId],grades:['三年级'],edition:['测试版A'],volume:['上册']};
assert.deepEqual(filterResources(resources,selected).map(resource=>resource.resourceId),[ids[0]]);
assert.deepEqual(facetOptions(resources,{schoolStages:['小学'],seriesId:[base.seriesId],grades:['三年级'],edition:['测试版A']}).volume.map(option=>option.value).sort(),['上册','下册']);
for (const change of [{edition:'最新版'},{edition:'待核验'},{grade:'高一'},{grade:undefined},{volume:'必修 第一册'}]) assert.throws(()=>textbookFacets({...base,...change}));
const high={...base,schoolStage:'高中',seriesId:'test-high',grade:undefined,volume:'必修 第一册'};
assert.deepEqual(textbookFacets(high).grades,[],'do not invent a universal grade for a high-school volume');
assert.notEqual(await textbookBookId(high),await textbookBookId({...high,volume:'选择性必修 第一册'}));
assert.throws(()=>textbookFacets({...high,volume:'上册'}));
assert.deepEqual(textbookFacets({...base,schoolStage:'初中',seriesId:'test-junior-5-4',grade:'六年级'}).grades,['六年级']);
console.log('Textbook profiles: stage/series/edition/grade/volume identity, dependent filtering, high-school original volumes and unknown-edition rejection passed.');
