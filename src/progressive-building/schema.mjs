import { hasSyntaxCycle } from './annotations.mjs';

export const SCHEMA_VERSION = 'progressive-building/3';

const ACTIVITIES = new Set([
  'compose', 'teach', 'transform', 'context-choice', 'range-identify',
  'identify', 'classify', 'independent-output', 'delayed-review',
]);
const PHASES = new Set(['introduction', 'practice', 'transfer', 'delayed-review']);
const tokenId = value => typeof value === 'string' && value.length > 0;

function fail(path, message) {
  throw new TypeError(`${path}: ${message}`);
}

function unique(values, path) {
  if (!Array.isArray(values) || new Set(values).size !== values.length) fail(path, 'must be an array of unique values');
}

function validateSegments(node, targetIds, nodeIds, path) {
  if (!Array.isArray(node.segments) || node.segments.length === 0) fail(`${path}.segments`, 'needs at least one segment');
  for (const [segmentIndex, segment] of node.segments.entries()) {
    if (!Array.isArray(segment) || segment.length === 0) fail(`${path}.segments[${segmentIndex}]`, 'must be a non-empty token-id array');
    if (segment.some(id => !targetIds.includes(id))) fail(`${path}.segments[${segmentIndex}]`, 'references a token outside the step target');
    const positions = segment.map(id => targetIds.indexOf(id));
    if (positions.some((position, index) => index > 0 && position !== positions[index - 1] + 1)) {
      fail(`${path}.segments[${segmentIndex}]`, 'must be an ordered contiguous range');
    }
  }
  if (node.parentId != null && !nodeIds.has(node.parentId)) fail(`${path}.parentId`, 'references an unknown syntax node');
  for (const field of ['headIds', 'modifiesIds']) {
    if (node[field] != null && (!Array.isArray(node[field]) || node[field].some(id => !targetIds.includes(id)))) {
      fail(`${path}.${field}`, 'must reference tokens in the step target');
    }
  }
}

export function validateLessonV3(lesson) {
  if (!lesson || lesson.schemaVersion !== SCHEMA_VERSION) fail('lesson.schemaVersion', `must be ${SCHEMA_VERSION}`);
  if (!tokenId(lesson.id) || !Number.isInteger(lesson.version) || lesson.version < 1) fail('lesson', 'needs a stable id and positive integer version');
  if (!tokenId(lesson.knowledgeNode) || !Array.isArray(lesson.subgoalIds) || lesson.subgoalIds.length === 0) fail('lesson', 'needs a knowledge node and subgoal ids');
  unique(lesson.subgoalIds, 'lesson.subgoalIds');
  if (!Array.isArray(lesson.tokens) || lesson.tokens.length === 0) fail('lesson.tokens', 'must not be empty');

  const tokens = new Map();
  for (const [index, token] of lesson.tokens.entries()) {
    const path = `lesson.tokens[${index}]`;
    if (!tokenId(token.id) || tokens.has(token.id)) fail(`${path}.id`, 'must be unique');
    if (typeof token.text !== 'string' || !token.text.trim() || !['word', 'punctuation'].includes(token.kind)) fail(path, 'needs text and a valid token kind');
    if (token.kind === 'punctuation' && /[\p{L}\p{N}]/u.test(token.text)) fail(`${path}.text`, 'punctuation tokens cannot contain letters or numbers');
    tokens.set(token.id, token);
  }

  if (!Array.isArray(lesson.steps) || lesson.steps.length === 0) fail('lesson.steps', 'must not be empty');
  const stepIds = new Set();
  for (const [index, step] of lesson.steps.entries()) {
    const path = `lesson.steps[${index}]`;
    if (!tokenId(step.id) || stepIds.has(step.id)) fail(`${path}.id`, 'must be unique');
    stepIds.add(step.id);
    if (!ACTIVITIES.has(step.activity) || !PHASES.has(step.phase)) fail(path, 'has an unsupported activity or phase');
    if (typeof step.meaning !== 'string' || !step.meaning.trim()) fail(`${path}.meaning`, 'must be a non-empty learner-facing cue');
    if (step.instruction != null && (typeof step.instruction !== 'string' || !step.instruction.trim())) fail(`${path}.instruction`, 'must be non-empty text');
    if (!Array.isArray(step.targetTokenIds) || step.targetTokenIds.some(id => !tokens.has(id))) fail(`${path}.targetTokenIds`, 'references an unknown token');
    unique(step.targetTokenIds, `${path}.targetTokenIds`);
    if (step.targetTokenIds.length === 0) fail(`${path}.targetTokenIds`, 'must not be empty');
    if (step.sourceTokenIds && step.sourceTokenIds.some(id => !tokens.has(id))) fail(`${path}.sourceTokenIds`, 'references an unknown token');
    if (!Array.isArray(step.coverage) || step.coverage.length === 0 || step.coverage.some(id => !lesson.subgoalIds.includes(id))) fail(`${path}.coverage`, 'must reference declared lesson subgoals');
    if (step.distractorTokenIds != null) {
      if (!Array.isArray(step.distractorTokenIds) || step.distractorTokenIds.some(id => !tokens.has(id) || step.targetTokenIds.includes(id))) fail(`${path}.distractorTokenIds`, 'must reference known tokens outside the target');
      unique(step.distractorTokenIds, `${path}.distractorTokenIds`);
    }
    if (step.bankTokenIds) {
      const availableIds = new Set([...step.targetTokenIds, ...(step.distractorTokenIds ?? [])]);
      if (step.bankTokenIds.some(id => !tokens.has(id) || !availableIds.has(id))) fail(`${path}.bankTokenIds`, 'must contain only target or declared distractor tokens');
      unique(step.bankTokenIds, `${path}.bankTokenIds`);
    }
    if (step.distractorTokenIds?.length && (!step.bankTokenIds || step.distractorTokenIds.some(id => !step.bankTokenIds.includes(id)))) fail(`${path}.distractorTokenIds`, 'each distractor must appear in the choice bank');
    if (step.distractorFeedback != null) {
      if (!step.distractorFeedback || typeof step.distractorFeedback !== 'object' || Array.isArray(step.distractorFeedback)) fail(`${path}.distractorFeedback`, 'must map distractor ids to feedback text');
      for (const [id, feedback] of Object.entries(step.distractorFeedback)) {
        if (!step.distractorTokenIds?.includes(id) || typeof feedback !== 'string' || !feedback.trim()) fail(`${path}.distractorFeedback.${id}`, 'must reference a distractor and contain feedback text');
      }
    }
    if ((step.distractorTokenIds || step.distractorFeedback) && step.activity !== 'compose') fail(path, 'distractors are only valid on compose activities');
    if (step.dependsOn) {
      if (!Array.isArray(step.dependsOn) || step.dependsOn.some(id => !stepIds.has(id))) fail(`${path}.dependsOn`, 'must reference earlier step ids');
      unique(step.dependsOn, `${path}.dependsOn`);
    }
    if (step.syntax) {
      if (!Array.isArray(step.syntax)) fail(`${path}.syntax`, 'must be an array');
      const syntaxIds = step.syntax.map(item => item.id);
      if (syntaxIds.some(id => !tokenId(id))) fail(`${path}.syntax`, 'each node needs a stable id');
      unique(syntaxIds, `${path}.syntax ids`);
      if (hasSyntaxCycle(step.syntax)) fail(`${path}.syntax`, 'parent relationships cannot contain cycles');
      for (const [syntaxIndex, item] of step.syntax.entries()) {
        validateSegments(item, step.targetTokenIds, new Set(syntaxIds), `${path}.syntax[${syntaxIndex}]`);
        for (let left = 0; left < item.segments.length; left++) for (const right of item.segments.slice(left + 1)) {
          if (item.segments[left].some(id => right.includes(id))) fail(`${path}.syntax[${syntaxIndex}].segments`, 'segments of one syntax node cannot overlap');
        }
        if (typeof item.role !== 'string' || !item.role.trim() || !Number.isInteger(item.level) || item.level < 0) fail(`${path}.syntax[${syntaxIndex}]`, 'needs a role and non-negative level');
        if (item.parentId != null) {
          const parent = step.syntax.find(candidate => candidate.id === item.parentId);
          if (parent && item.level <= parent.level) fail(`${path}.syntax[${syntaxIndex}].level`, 'must be deeper than its parent');
          if (!parent || item.segments.some(segment => !parent.segments.some(parentSegment => segment.every(id => parentSegment.includes(id))))) {
            fail(`${path}.syntax[${syntaxIndex}].parentId`, 'parent must contain each child range');
          }
        }
        for (const other of step.syntax.slice(syntaxIndex + 1)) {
          if (item.level !== other.level) continue;
          for (const left of item.segments) for (const right of other.segments) {
            if (left.some(id => right.includes(id))) fail(`${path}.syntax`, 'same-level annotations cannot overlap');
          }
        }
      }
    }
    if (step.activity === 'teach' && (!step.explanation || !Array.isArray(step.focusTokenIds) || step.focusTokenIds.length === 0)) fail(path, 'teaching needs a sentence-bound explanation and focus tokens');
    if (step.focusTokenIds?.some(id => !step.targetTokenIds.includes(id) && !step.sourceTokenIds?.includes(id))) fail(`${path}.focusTokenIds`, 'must reference target or source tokens');
    if (step.activity === 'transform' && (!Array.isArray(step.operations) || step.operations.length === 0 || !Array.isArray(step.sourceTokenIds) || step.sourceTokenIds.length === 0)) fail(path, 'transform needs a source sentence and explicit operations');
    if (step.activity === 'range-identify' && (!step.focusSyntaxId || !step.syntax?.some(item => item.id === step.focusSyntaxId) || !Array.isArray(step.sourceTokenIds) || step.sourceTokenIds.length === 0)) {
      fail(path, 'range-identify needs a focused syntax node and source sentence tokens');
    }
    if (step.activity === 'transform') for (const [operationIndex, operation] of step.operations.entries()) {
      if (!['insert', 'delete', 'move', 'replace'].includes(operation.type) || !Array.isArray(operation.from) || !Array.isArray(operation.to)) fail(`${path}.operations[${operationIndex}]`, 'needs a supported operation and token identity arrays');
      if (operation.from.some(id => !tokens.has(id)) || operation.to.some(id => !tokens.has(id))) fail(`${path}.operations[${operationIndex}]`, 'references an unknown token');
      unique(operation.from, `${path}.operations[${operationIndex}].from`);
      unique(operation.to, `${path}.operations[${operationIndex}].to`);
      if (operation.from.length === 0 && operation.type !== 'insert' || operation.to.length === 0 && operation.type !== 'delete') fail(`${path}.operations[${operationIndex}]`, 'operation has an empty required side');
      if (operation.from.some(id => !step.sourceTokenIds.includes(id))) fail(`${path}.operations[${operationIndex}].from`, 'must reference the source sentence');
      const fromPositions = operation.from.map(id => step.sourceTokenIds.indexOf(id));
      if (fromPositions.some((position, index) => index > 0 && position !== fromPositions[index - 1] + 1)) fail(`${path}.operations[${operationIndex}].from`, 'must be a contiguous source range in sentence order');
      if (['insert', 'move'].includes(operation.type)) {
        if (!tokenId(operation.anchorId) || !step.sourceTokenIds.includes(operation.anchorId) || operation.from.includes(operation.anchorId)) fail(`${path}.operations[${operationIndex}].anchorId`, 'insert and move need a stable source anchor outside the moved range');
        if (operation.position != null && !['before', 'after'].includes(operation.position)) fail(`${path}.operations[${operationIndex}].position`, 'must be before or after the anchor');
      }
      if (operation.type === 'move' && (operation.from.length !== operation.to.length || operation.from.some((id, index) => id !== operation.to[index]))) fail(`${path}.operations[${operationIndex}].to`, 'move must preserve the moved token identities and order');
      if (operation.key != null && !/^[a-z]$/i.test(operation.key)) fail(`${path}.operations[${operationIndex}].key`, 'must be a single letter shortcut');
        if (operation.type === 'replace' && operation.to.length === 1 && tokens.get(operation.to[0]).kind === 'word' && operation.key?.toLowerCase() !== tokens.get(operation.to[0]).text[0].toLowerCase()) {
          fail(`${path}.operations[${operationIndex}].key`, 'must match the first letter of the replacement token');
        }
    }
    if (step.activity === 'independent-output' || step.activity === 'delayed-review') {
      if (!Array.isArray(step.acceptedAnswers) || step.acceptedAnswers.length === 0) fail(`${path}.acceptedAnswers`, 'needs reviewed answers');
      if (step.revealTarget === true) fail(`${path}.revealTarget`, 'must not expose the target during independent recall');
    }
    if (step.allowUnknownResponse != null && typeof step.allowUnknownResponse !== 'boolean') fail(`${path}.allowUnknownResponse`, 'must be boolean');
    if (step.hintText != null && (typeof step.hintText !== 'string' || !step.hintText.trim())) fail(`${path}.hintText`, 'must be non-empty text');
    if (step.showEvidence != null && typeof step.showEvidence !== 'boolean') fail(`${path}.showEvidence`, 'must be boolean');
    if (step.scheduleAssistedReview != null && typeof step.scheduleAssistedReview !== 'boolean') fail(`${path}.scheduleAssistedReview`, 'must be boolean');
    if ((step.allowUnknownResponse || step.hintText || step.showEvidence || step.scheduleAssistedReview) && !['independent-output', 'delayed-review'].includes(step.activity)) fail(path, 'recall support is only valid on output activities');
  }
  const coveredSubgoals = new Set(lesson.steps.flatMap(step => step.coverage ?? []));
  for (const id of lesson.subgoalIds) if (!coveredSubgoals.has(id)) fail('lesson.subgoalIds', `uncovered subgoal ${id}`);
  if (lesson.review) {
    if (!Array.isArray(lesson.review.intervalsDays) || lesson.review.intervalsDays.some(days => !Number.isInteger(days) || days < 1)) fail('lesson.review.intervalsDays', 'must contain positive integer day intervals');
    if (!Array.isArray(lesson.review.stepIds) || lesson.review.stepIds.some(id => !lesson.steps.some(step => step.id === id && step.phase === 'transfer'))) fail('lesson.review.stepIds', 'must reference transfer steps in this lesson');
  }
  return lesson;
}

export function validateCatalog(catalog) {
  if (!Array.isArray(catalog) || catalog.length !== 50) fail('catalog', 'must contain exactly 50 knowledge nodes');
  const ids = new Set(catalog.map(node => node.id));
  if (ids.size !== 50 || [...Array(50)].some((_, index) => !ids.has(`PB${String(index + 1).padStart(2, '0')}`))) {
    fail('catalog', 'must contain each stable node id from PB01 to PB50 once');
  }
  for (const node of catalog) {
    if (!node.title || !Array.isArray(node.subgoalIds) || node.subgoalIds.length === 0 || !['planned', 'draft', 'preview'].includes(node.status)) {
      fail(`catalog.${node.id}`, 'needs a title, subgoals and a valid status');
    }
    for (const prerequisite of node.prerequisites ?? []) if (!ids.has(prerequisite)) fail(`catalog.${node.id}.prerequisites`, `unknown node ${prerequisite}`);
    unique(node.subgoalIds, `catalog.${node.id}.subgoalIds`);
    if (node.subgoalIds.some(id => !id.startsWith(`${node.id}.`))) fail(`catalog.${node.id}.subgoalIds`, 'must be namespaced to the node');
  }
  const visit = (id, active = new Set(), done = new Set()) => {
    if (active.has(id)) fail('catalog.prerequisites', `dependency cycle includes ${id}`);
    if (done.has(id)) return;
    active.add(id);
    for (const dependency of catalog.find(node => node.id === id).prerequisites ?? []) visit(dependency, active, done);
    active.delete(id); done.add(id);
  };
  const done = new Set();
  for (const node of catalog) visit(node.id, new Set(), done);
  return catalog;
}
