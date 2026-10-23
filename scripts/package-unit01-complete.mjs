import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateExpressionPackage} from '../src/expression-course/validate.mjs';

const root = process.cwd();
const target = path.resolve(process.argv[2] || 'output/expression-course-drafts/unit01-complete-v2');
const sourcePackagePath = path.join(root, 'output/expression-course-drafts/unit01-formal-v1/course-package.json');
const sourceAssetsDir = path.dirname(sourcePackagePath);
const authoredPath = path.join(root, 'assets/expression-unit01-complete-lessons.json');
const manifestPath = path.join(target, 'audio-manifest.json');
const source = JSON.parse(fs.readFileSync(authoredPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (fs.existsSync(path.join(target, 'course-package.json'))) throw new Error(`Refusing to overwrite existing package in ${target}`);
const oldPackage = JSON.parse(fs.readFileSync(sourcePackagePath, 'utf8'));
const oldHash = createHash('sha256').update(fs.readFileSync(sourcePackagePath)).digest('hex');
if (oldHash !== 'c20831494d5cfdd3834dcd790c6ba5340d48851722eb145bdd82a7f17f2396b3') throw new Error('Existing two-lesson package differs from the accepted package hash');
if (oldPackage.lessons.map(lesson => lesson.lessonId).join(',') !== 'L101,L103') throw new Error('Expected the accepted L101/L103 package');

const manifestById = new Map(manifest.map(asset => [asset.assetId, asset]));
if (manifestById.size !== manifest.length) throw new Error('Duplicate audio assetId in generated manifest');
const newLessons = source.lessons.map(draft => {
  const audioAssets = draft.audio.map(audio => {
    const generated = manifestById.get(audio.assetId);
    if (!generated || generated.file !== audio.file || generated.text !== audio.text || !generated.voice || generated.rate !== audio.rate) {
      throw new Error(`Audio manifest does not match authored source for ${audio.assetId}`);
    }
    const bytes = fs.readFileSync(path.join(target, generated.file));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (bytes.length !== generated.size || sha256 !== generated.sha256 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
      throw new Error(`WAV integrity check failed for ${audio.assetId}`);
    }
    if (!(generated.durationSeconds > 0)) throw new Error(`Missing WAV duration for ${audio.assetId}`);
    return {assetId: audio.assetId, text: audio.text, locale: 'en-US', status: 'ready'};
  });
  const lesson = {
    schemaVersion: '1.0', lessonId: draft.lessonId, contentVersion: draft.contentVersion, status: 'draft', locale: 'zh-CN',
    title: draft.title, communicationGoal: draft.goal, prerequisiteSkillIds: draft.prerequisiteSkillIds,
    taughtSkillIds: [draft.skillId], vocabulary: draft.vocabulary, audioAssets,
    activities: draft.activities.map((activity, index) => {
      const id = `${draft.lessonId}_A${String(index + 1).padStart(2, '0')}`;
      let payload, evaluation;
      if (activity.type === 'meaning_intro') {
        payload = {exampleEnglish: activity.english, exampleZh: activity.meaning, audioAssetId: activity.audioAssetId};
        evaluation = {countsTowardMastery: false};
      } else if (activity.type === 'listening_choice') {
        payload = {audioAssetId: activity.audioAssetId, options: activity.options.map((textZh, optionIndex) => ({id: `option_${optionIndex}`, textZh}))};
        evaluation = {countsTowardMastery: true, correctOptionId: activity.correctOptionId};
      } else {
        payload = {scenario: activity.scenario, targetMeaning: activity.targetMeaning, responseModes: activity.responseModes};
        evaluation = {countsTowardMastery: true, acceptedAnswers: activity.acceptedAnswers};
      }
      return {id, type: activity.type, stage: activity.stage, prompt: activity.prompt, skillIds: [draft.skillId], payload, evaluation};
    }),
    reviewPlan: {intervalDays: [1, 3, 7, 14]}
  };
  return lesson;
});
if (manifest.length !== source.lessons.reduce((count, lesson) => count + lesson.audio.length, 0)) throw new Error('Unexpected extra or missing generated audio asset');

const oldLessonCopies = structuredClone(oldPackage.lessons);
const lessonsById = new Map([...oldLessonCopies, ...newLessons].map(lesson => [lesson.lessonId, lesson]));
const lessons = ['L101', 'L102', 'L103', 'L104', 'L105'].map(id => lessonsById.get(id));
if (lessons.some(lesson => !lesson)) throw new Error('Five-lesson order is incomplete');
const assets = [...oldPackage.assets];
const reviewActivities = [...oldPackage.reviewActivities];
for (const lesson of newLessons) {
  const draft = source.lessons.find(item => item.lessonId === lesson.lessonId);
  for (const audio of draft.audio) {
    const generated = manifestById.get(audio.assetId);
    assets.push({assetId: audio.assetId, mimeType: 'audio/wav', localFile: generated.file, size: generated.size, sha256: generated.sha256});
  }
  for (const activityId of draft.reviewActivityIds) reviewActivities.push({lessonId: lesson.lessonId, skillId: draft.skillId, activityId});
}
const pkg = {...oldPackage, title: '零基础入门：学习指令、问候与求助', description: '五节新编零基础英语入门课候选包；不含配图、语音录音、识别或口语评分。', lessons, assets, reviewActivities};
const result = validateExpressionPackage(pkg, {forPublish: true, availableAssets: assets.map(asset => asset.assetId)});
if (!result.valid) throw new Error(result.errors.join('\n'));

fs.mkdirSync(target, {recursive: true});
for (const asset of oldPackage.assets) {
  const from = path.join(sourceAssetsDir, asset.localFile);
  const bytes = fs.readFileSync(from);
  if (bytes.length !== asset.size || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error(`Existing audio integrity check failed: ${asset.localFile}`);
  const to = path.join(target, asset.localFile);
  if (!fs.existsSync(to)) fs.writeFileSync(to, bytes, {flag: 'wx'});
}
const packageBytes = Buffer.from(JSON.stringify(pkg, null, 2) + '\n');
fs.writeFileSync(path.join(target, 'course-package.json'), packageBytes, {flag: 'wx'});
const audioTotal = assets.reduce((sum, asset) => sum + asset.size, 0);
const validation = {
  validForPublish: result.valid, published: false,
  packageSha256: createHash('sha256').update(packageBytes).digest('hex'),
  reusedLessonPackageSha256: oldHash,
  lessons: lessons.map(lesson => ({lessonId: lesson.lessonId, activityCount: lesson.activities.length, skillIds: lesson.taughtSkillIds})),
  audioAssetCount: assets.length,
  audioBytes: audioTotal,
  newAudio: manifest.map(({assetId, file, text, voice, rate, size, sha256, durationSeconds}) => ({assetId, file, text, voice, rate, size, sha256, durationSeconds})),
  oldAudioIntegrity: oldPackage.assets.map(({assetId, localFile, size, sha256}) => ({assetId, localFile, size, sha256, verified: true})),
  schemaErrors: result.errors
};
fs.writeFileSync(path.join(target, 'validation.json'), JSON.stringify(validation, null, 2) + '\n', {flag: 'wx'});
fs.writeFileSync(path.join(target, 'content-source.json'), fs.readFileSync(authoredPath), {flag: 'wx'});
console.log(JSON.stringify({target, ...validation}, null, 2));
