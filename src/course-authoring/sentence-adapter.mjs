import { SENTENCE_TEMPLATE, inspectLearning } from './learning-contract.mjs';
import { normalizeDraftText } from './draft-validator.mjs';

function sameAnswer(left, right) { return normalizeDraftText(left).toLocaleLowerCase('en') === normalizeDraftText(right).toLocaleLowerCase('en'); }

export class SentenceCourseAdapter {
  /** @param {object} draft @param {{deckId?:string,catalogCourseId?:string,legacySource?:object,lineIds?:string[]}} options */
  compile(draft, { deckId, catalogCourseId = `user-deck:${deckId}`, legacySource = null, lineIds = null } = {}) {
    if (!draft || draft.format !== 'chunklab-ai-course' || !deckId) throw new Error('原生句子课程缺少已验证的课程内容或课程身份。');
    const report = inspectLearning(draft);
    const errors = report.issues.filter((item) => item.severity === 'error');
    if (errors.length) throw Object.assign(new Error(errors.map((item) => item.message).join('；')), { report });
    const items = draft.items.map((item, index) => {
      if (!Array.isArray(item.chunks) || !Array.isArray(item.hints) || item.chunks.length !== item.hints.length) {
        throw new Error(`第 ${index + 1} 句需要为每个意群提供中文提示。`);
      }
      if ((item.acceptedAnswers || []).some((answer) => !sameAnswer(answer, item.en))) {
        throw new Error(`第 ${index + 1} 句包含原生练习无法保留的整句替代答案。请让 AI 删除或改写这些答案。`);
      }
      const sourceRole = item.role && (draft.roles || []).find((role) => role.key === item.role);
      return {
        cid: lineIds && lineIds[index] || `${deckId}:line:${String(index + 1).padStart(3, '0')}`,
        sentence: item.en,
        translation: item.zh,
        chunks: item.chunks.slice(),
        hints: item.hints.slice(),
        ...(item.distractors ? { distractors: item.distractors.map((group) => group.slice()) } : {}),
        ...(item.explanation ? { explain: item.explanation } : {}),
        authoring: { sourceIndex: index, ...(sourceRole ? { roleId: sourceRole.key, roleName: sourceRole.name } : {}) }
      };
    });
    return {
      id: deckId, name: draft.title, short: draft.title, desc: draft.description || '', items,
      authoring: {
        schemaVersion: 1, formatVersion: draft.formatVersion, template: SENTENCE_TEMPLATE.id,
        templateVersion: SENTENCE_TEMPLATE.version, contentForm: draft.contentForm,
        targetCefr: draft.targetCefr,
        learning: structuredClone(draft.learning), roles: structuredClone(draft.roles || []),
        ...(draft.source ? { source: structuredClone(draft.source) } : {}), catalogCourseId,
        ...(legacySource ? { legacySource: structuredClone(legacySource) } : {})
      }
    };
  }

  projectForExport(deck) {
    if (!deck || !deck.authoring || deck.authoring.schemaVersion !== 1 || deck.authoring.template !== SENTENCE_TEMPLATE.id) throw new Error('这不是可导出的 AI 句子课程。');
    const roles = deck.authoring.roles || [];
    const items = (deck.items || []).map((item) => ({
      en: item.sentence, zh: item.translation,
      ...(item.authoring && item.authoring.roleId ? { role: item.authoring.roleId } : {}),
      chunks: item.chunks.slice(), hints: item.hints.slice(),
      ...(item.distractors ? { distractors: item.distractors.map((group) => group.slice()) } : {}),
      ...(item.explain ? { explanation: item.explain } : {})
    }));
    return {
      format: 'chunklab-ai-course', formatVersion: '1.1', title: deck.name, description: deck.desc || '',
      targetCefr: deck.authoring.targetCefr || 'A2', contentForm: deck.authoring.contentForm,
      roles, learning: structuredClone(deck.authoring.learning), items,
      ...(deck.authoring.source ? { source: structuredClone(deck.authoring.source) } : {})
    };
  }
}
