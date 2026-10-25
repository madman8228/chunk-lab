import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { validateExpressionPackage } from '../src/expression-course/validate.mjs';
import { validateKnowledgeMap } from '../src/beginner-curriculum/validate.mjs';
import defaultMap from '../src/beginner-curriculum/knowledge-map.json' with { type: 'json' };

const args = process.argv.slice(2);
const valueAfter = key => { const index = args.indexOf(key); return index >= 0 ? args[index + 1] : null; };
const packagePath = valueAfter('--package');
if (!packagePath) {
  console.error('用法：node scripts/validate-beginner-course.mjs --package <path> [--map <path>] [--for-publish]');
  process.exitCode = 2;
} else {
  const resolvedPackage = path.resolve(packagePath), packageRoot = path.dirname(resolvedPackage);
  const pkg = JSON.parse(fs.readFileSync(resolvedPackage, 'utf8'));
  const mapPath = valueAfter('--map');
  const knowledgeMap = mapPath ? JSON.parse(fs.readFileSync(path.resolve(mapPath), 'utf8')) : defaultMap;
  const mapResult = validateKnowledgeMap(knowledgeMap);
  const forPublish = args.includes('--for-publish');
  const result = validateExpressionPackage(pkg, { forPublish, curriculumMap: knowledgeMap });
  const errors = [...result.errors, ...mapResult.errors.map(message => `知识目录：${message}`)];
  const contentHash = crypto.createHash('sha256').update(JSON.stringify(pkg)).digest('hex');
  const audioStates = [];
  for (const asset of pkg.assets || []) {
    const localFile = typeof asset.localFile === 'string' ? path.resolve(packageRoot, asset.localFile) : '';
    const exists = Boolean(localFile && localFile.startsWith(packageRoot + path.sep) && fs.existsSync(localFile));
    if (!exists) {
      audioStates.push({ assetId: asset.assetId, status: 'pending', reason: '音频文件缺失' });
      if (forPublish) errors.push(`音频缺失：${asset.assetId}`);
      continue;
    }
    const bytes = fs.readFileSync(localFile), sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    const signatureValid = asset.mimeType === 'audio/mpeg' ? bytes.subarray(0, 3).toString() === 'ID3' || bytes[0] === 255 && (bytes[1] & 224) === 224
      : asset.mimeType === 'audio/ogg' ? bytes.subarray(0, 4).toString() === 'OggS'
        : asset.mimeType === 'audio/wav' && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WAVE';
    if (!signatureValid) errors.push(`音频格式校验失败：${asset.assetId}`);
    if (forPublish && (asset.sha256 !== sha256 || asset.size !== bytes.length)) errors.push(`音频摘要或大小不匹配：${asset.assetId}`);
    if (forPublish) {
      const decoded = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name', '-of', 'default=noprint_wrappers=1:nokey=1', localFile], { encoding: 'utf8' });
      if (decoded.error || decoded.status !== 0 || !decoded.stdout.trim()) errors.push(`音频无法经 ffprobe 解码：${asset.assetId}`);
    }
    audioStates.push({ assetId: asset.assetId, status: asset.sha256 === sha256 && asset.size === bytes.length && signatureValid ? 'file-verified-review-pending' : 'pending', sha256, size: bytes.length });
  }
  if (forPublish) {
    const manifestPath = path.join(packageRoot, 'review-manifest.json');
    const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
    const approvedAssets = new Map((manifest?.assets || []).filter(item => item?.status === 'approved' && item.sha256).map(item => [item.assetId, item.sha256]));
    const allAudioReviewed = (pkg.assets || []).every(item => approvedAssets.get(item.assetId) === item.sha256);
    if (!manifest || manifest.contentHash !== contentHash || manifest.contentReview !== 'approved' || manifest.audioReview !== 'approved' || manifest.publication !== 'approved' || !allAudioReviewed) {
      errors.push('审核清单缺失、未批准或未绑定当前内容hash');
    }
  }
  const report = { package: path.relative(process.cwd(), resolvedPackage), formatVersion: pkg.formatVersion,
    lessonCount: pkg.lessons?.length || 0, activityCount: (pkg.lessons || []).reduce((sum, lesson) => sum + (lesson.activities?.length || 0), 0),
    knowledgeGoals: [...new Set((pkg.lessons || []).flatMap(lesson => lesson.knowledgeIds || []))], contentHash,
    contentReview: 'pending', audioReview: audioStates.every(item => item.status === 'file-verified-review-pending') ? 'pending-human-review' : 'pending-assets',
    publication: 'pending', audio: audioStates, valid: errors.length === 0, errors };
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exitCode = 1;
}
