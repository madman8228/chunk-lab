import { createCourseAuthoringService } from '../src/course-authoring/create-service.mjs';
import { buildEvidencePack } from '../src/mistake-review/evidence-pack.mjs';
import { composeBatchSummaryPrompt, composeMistakePrompt, composeSummaryMergePrompt } from '../src/mistake-review/prompt-composer.mjs';
import { BATCH_SIZE, buildBatchExport, byteLength, createExportSnapshot, createExportSnapshotAsync, describeBatch } from '../src/mistake-review/batch-export.mjs';

const api = {
  buildEvidencePack,
  composeMistakePrompt,
  composeBatchSummaryPrompt,
  composeSummaryMergePrompt,
  BATCH_SIZE,
  buildBatchExport,
  byteLength,
  createExportSnapshot,
  createExportSnapshotAsync,
  describeBatch,
  async createPracticeSession(publicPack, localSourceRefs) {
    const runtime = createCourseAuthoringService(globalThis);
    const baseline = Object.fromEntries(publicPack.records.map((record) => [record.ref, record.stats]));
    const session = await runtime.service.open({
      brief: `根据 ${publicPack.records.length} 道错题制作迁移练习。`,
      reviewContext: { version: 1, task: 'practice', publicPack, localSourceRefs, baseline },
    });
    if (runtime.sessionRepository.persistenceWarning) throw new Error('本机制作草稿未能持久化。指令仍可复制或下载；请修复本机存储后再进入制作工作台。');
    return session.sessionId;
  },
};
if (typeof globalThis !== 'undefined') globalThis.MistakeReview = Object.freeze(api);
export { api as MistakeReview };
