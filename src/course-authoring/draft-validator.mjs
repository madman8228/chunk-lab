import { DRAFT_SCHEMA, LEGACY_DRAFT_SCHEMA } from './draft-spec.mjs';
import { CourseCapabilityCatalog } from './capabilities.mjs';
import { inspectLearning } from './learning-contract.mjs';

function pathFor(instancePath) {
  return String(instancePath || '').replace(/\/(\d+)/g, '[$1]').replace(/\//g, '.').replace(/^\./, '') || '课程';
}
export function normalizeDraftText(value) { return String(value == null ? '' : value).replace(/[\t\n\f\r ]+/g, ' ').trim(); }
function issue(code, path, message, suggestion, severity = 'error') { return { code, path, severity, message, suggestion }; }
function schemaIssue(raw) {
  let instancePath = '', message = '';
  if (raw && typeof raw === 'object') { instancePath = raw.instancePath || raw.path || ''; message = raw.message || '字段不符合课程格式。'; }
  else {
    const text = String(raw || '');
    const match = text.match(/^(\S*)\s+(.*)$/);
    if (match) { instancePath = match[1]; message = match[2]; } else message = text;
  }
  const required = message.match(/required property ["']([^"']+)["']/i);
  if (required) instancePath += `/${required[1]}`;
  const localized = /required property/i.test(message) ? '缺少必填字段。'
    : /additional propert/i.test(message) ? '包含课程格式未定义的字段。'
      : /must be string/i.test(message) ? '应填写文字内容。'
        : /must be array/i.test(message) ? '应使用列表格式。'
          : /must be equal to|must be one of|must match/i.test(message) ? '取值不符合课程格式要求。'
            : '课程字段格式不符合要求。';
  return issue('SCHEMA_INVALID', pathFor(instancePath), localized, required ? `补上“${required[1]}”字段。` : '根据课程规范调整这个字段后，再导入完整课程。');
}

export class AiDraftValidator {
  constructor({ schemaValidator, chunkShape = null }) {
    if (!schemaValidator || typeof schemaValidator.validate !== 'function') throw new Error('AiDraftValidator 需要注入 SchemaValidator');
    this.schemaValidator = schemaValidator;
    this.chunkShape = chunkShape;
  }

  validate(draft, preferences = null) {
    const issues = [];
    const sourceVersion = draft && draft.formatVersion;
    const legacy = sourceVersion === '1.0';
    if (!legacy && sourceVersion !== '1.1') issues.push(issue('UNSUPPORTED_VERSION', 'formatVersion', '网站暂不支持这个课程格式版本。', '请使用 Chunk Lab AI Course Draft 1.1 规范重新生成。'));
    const result = this.schemaValidator.validate(legacy ? LEGACY_DRAFT_SCHEMA : DRAFT_SCHEMA, draft);
    (result.errors || []).forEach((error) => issues.push(schemaIssue(error)));
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return { valid: false, issues, supportedModes: [] };
    if (!Array.isArray(draft.items)) return { valid: false, issues, supportedModes: [] };

    let canonicalDraft = draft;
    if (legacy) {
      const capabilities = CourseCapabilityCatalog.fromDraft(draft);
      const modes = ['typing', ...(capabilities.chunkSelection ? ['chunkSelection'] : [])];
      canonicalDraft = {
        ...draft, formatVersion: '1.1',
        learning: { template: 'sentence-practice', version: 1, modes, defaultMode: 'typing' },
        items: draft.items.map((item) => ({
          ...item,
          ...(Array.isArray(item.chunks) ? { hints: item.chunks.map((chunk) => `${String(chunk).trim().split(/\s+/).filter(Boolean).length} 词`) } : {}),
          ...(Array.isArray(item.distractors) && item.distractors.length ? { distractors: [] } : {})
        }))
      };
      issues.push(issue('LEGACY_FORMAT', 'formatVersion', '这是一份旧版 AI 课程，将转换为现有句子练习。', '检查课程预览；缺少意群提示的旧内容会使用词数提示。', 'warning'));
      if (draft.items.some((item) => Array.isArray(item.distractors) && item.distractors.length)) issues.push(issue('LEGACY_DISTRACTORS', 'items', '旧版干扰项没有标明对应的意群位置，转换时不会沿用。', '检查练习预览；需要特定干扰项时，请让 AI 按新版格式重新生成。', 'warning'));
    }

    const keys = new Set();
    (draft.roles || []).forEach((role, index) => {
      if (!role || typeof role.key !== 'string') return;
      if (keys.has(role.key)) issues.push(issue('DUPLICATE_ROLE', `roles[${index}].key`, `角色标识“${role.key}”重复。`, '为每个角色提供不同的 key。'));
      keys.add(role.key);
    });
    const form = draft.contentForm;
    if (form === 'dialogue' && (draft.roles || []).length < 2) issues.push(issue('DIALOGUE_ROLES_REQUIRED', 'roles', '情景对话至少需要两个角色。', '添加两位角色，并为每句台词指定说话人。'));
    if (form !== 'dialogue' && Array.isArray(draft.roles) && draft.roles.length) issues.push(issue('UNUSED_ROLES', 'roles', '句子集或短文不需要对话角色。', '将 roles 设为空数组。'));

    let anyChunks = false, allChunks = draft.items.length > 0;
    const seenChunks = new Set();
    draft.items.forEach((item, index) => {
      if (!item || typeof item !== 'object') { allChunks = false; return; }
      if (form === 'dialogue') {
        if (!item.role || !keys.has(item.role)) issues.push(issue('UNKNOWN_ROLE', `items[${index}].role`, `第 ${index + 1} 句没有引用有效角色。`, '补上这句话的角色 key，确保与 roles 中一致。'));
        else seenChunks.add(item.role);
      } else if (item.role != null) issues.push(issue('UNEXPECTED_ROLE', `items[${index}].role`, '当前形式不能指定角色。', '仅情景对话使用 role 字段。'));

      if (Array.isArray(item.chunks) && item.chunks.length) {
        anyChunks = true;
        if (this.chunkShape && !this.chunkShape.chunkCountOk(item.en, item.chunks)) issues.push(issue('CHUNK_COUNT_INVALID', `items[${index}].chunks`, `第 ${index + 1} 句的意群数量不符合学习要求。`, this.chunkShape.chunkCountError(item.en, item.chunks)));
        const joined = normalizeDraftText(item.chunks.join(' '));
        if (joined !== normalizeDraftText(item.en)) issues.push(issue('CHUNK_TEXT_MISMATCH', `items[${index}].chunks`, `第 ${index + 1} 句的意群拼接结果与英文原句不一致。`, '调整意群边界，使按顺序用空格拼接后与英文原句完全相同，包括标点。'));
        const correct = new Set(item.chunks.map((chunk) => normalizeDraftText(chunk).toLocaleLowerCase('en')));
        const distractors = Array.isArray(item.distractors) ? item.distractors : [];
        if (!legacy && distractors.length && distractors.length !== item.chunks.length) issues.push(issue('DISTRACTOR_COUNT_MISMATCH', `items[${index}].distractors`, `第 ${index + 1} 句的干扰项组数必须与意群数量相同。`, '为每个意群提供一组干扰项；没有干扰项的意群用空数组表示。'));
        const groups = legacy ? [] : distractors;
        groups.forEach((group, groupIndex) => {
          const local = new Set([...(item.chunks[groupIndex] ? [normalizeDraftText(item.chunks[groupIndex]).toLocaleLowerCase('en')] : [])]);
          (group || []).forEach((word, distractorIndex) => {
            const normal = normalizeDraftText(word).toLocaleLowerCase('en');
            if (local.has(normal) || correct.has(normal)) issues.push(issue('DUPLICATE_DISTRACTOR', `items[${index}].distractors[${groupIndex}][${distractorIndex}]`, `第 ${index + 1} 句的干扰项与正确意群或其他干扰项重复。`, '删除这个干扰项或换成不同表达。'));
            local.add(normal);
          });
        });
        if (Array.isArray(item.acceptedAnswers)) {
          if (!item.acceptedAnswers.some((answer) => normalizeDraftText(answer).toLocaleLowerCase('en') === normalizeDraftText(item.en).toLocaleLowerCase('en'))) issues.push(issue('CANONICAL_ANSWER_MISSING', `items[${index}].acceptedAnswers`, `第 ${index + 1} 句的允许答案没有包含原句。`, '保留英文原句作为允许答案。'));
          if (item.acceptedAnswers.some((answer) => normalizeDraftText(answer) && normalizeDraftText(answer).toLocaleLowerCase('en') !== normalizeDraftText(item.en).toLocaleLowerCase('en'))) issues.push(issue('UNSUPPORTED_ALTERNATE_ANSWER', `items[${index}].acceptedAnswers`, `第 ${index + 1} 句包含当前意群练习无法验证的整句替代答案。`, '请让 AI 只保留标准原句，或改为与原句完全相同的规范化形式。'));
        }
        if (!legacy && (!Array.isArray(item.hints) || item.hints.length !== item.chunks.length)) issues.push(issue('HINT_COUNT_MISMATCH', `items[${index}].hints`, `第 ${index + 1} 句需要为每个意群提供一个中文提示。`, '让 AI 按意群顺序补齐 hints。'));
      } else {
        allChunks = false;
        if (Array.isArray(item.distractors) && item.distractors.length) issues.push(issue('DISTRACTORS_REQUIRE_CHUNKS', `items[${index}].distractors`, `第 ${index + 1} 句没有意群，不能添加意群干扰项。`, '为这句话添加完整 chunks，或删除 distractors。'));
      }
    });
    if (anyChunks && !allChunks) issues.push(issue('PARTIAL_CHUNKS', 'items', '课程只为部分句子提供了意群，学习能力不完整。', '为每句话补齐意群，或删除全部 chunks 字段。'));

    if (form === 'dialogue' && seenChunks.size < 2) issues.push(issue('ROLE_NOT_USED', 'items', '对话角色没有都在台词中出现。', '检查每句话的 role，确保两位角色都参与对话。'));
    if (form === 'article' && draft.items.length < 2) issues.push(issue('ARTICLE_TOO_SHORT', 'items', '短文至少需要两句，才能作为连续阅读内容。', '将短文拆成至少两句。', 'warning'));
    if (!anyChunks) issues.push(issue('NO_CHUNKS', 'items', '现有句子学习需要每句话都有完整意群。', '让 AI 为每句补上与原文完全匹配的 chunks。'));
    if (draft && Array.isArray(draft.roles) && draft.roles.length > 2) issues.push(issue('MANY_ROLES', 'roles', '角色较多，手机上阅读可能不够清楚。', '考虑将角色数量控制在两至四位。', 'warning'));
    if (!legacy) issues.push(...inspectLearning(draft, preferences).issues);
    else {
      canonicalDraft.items.forEach((item, index) => {
        if (Array.isArray(item.chunks) && item.chunks.some((chunk) => this.chunkShape && !this.chunkShape.chunkCountOk(item.en, item.chunks))) return;
        if (Array.isArray(item.acceptedAnswers) && item.acceptedAnswers.some((answer) => normalizeDraftText(answer) && normalizeDraftText(answer).toLocaleLowerCase('en') !== normalizeDraftText(item.en).toLocaleLowerCase('en'))) issues.push(issue('UNSUPPORTED_ALTERNATE_ANSWER', `items[${index}].acceptedAnswers`, `第 ${index + 1} 句包含当前意群练习无法验证的整句替代答案。`, '请让 AI 只保留标准原句。'));
        if (!Array.isArray(item.chunks) || !item.chunks.length) issues.push(issue('CHUNKS_REQUIRED', `items[${index}].chunks`, `第 ${index + 1} 句缺少意群，无法接入现有句子练习。`, '让 AI 按新版规范补齐意群与中文提示。'));
      });
    }
    const capabilities = CourseCapabilityCatalog.fromDraft(canonicalDraft);
    const supportedModes = CourseCapabilityCatalog.resolveRuntimeModes({ capabilities,
      roles: (canonicalDraft.roles || []).map((role) => ({ id: role.key, name: role.name })),
      utterances: canonicalDraft.items.map((item, index) => ({ id: `line-${index}`, roleId: item.role || null, chunks: item.chunks ? { items: item.chunks } : null, text: { en: item.en } }))
    });
    return { valid: !issues.some((entry) => entry.severity === 'error'), issues, capabilities, supportedModes, canonicalDraft };
  }
}
