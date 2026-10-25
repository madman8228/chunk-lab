import schema from '../expression-package.schema.json' with { type: 'json' };
import lessonSchema from '../lesson.schema.json' with { type: 'json' };
import { createExpressionV11Schemas } from '../schema-v1.1.mjs';

export function makeExpressionCoursePrompt({ formatVersion = '1.0', track = 'sentence-building' } = {}) {
  const v11 = formatVersion === '1.1';
  const selectedSchemas = v11 ? createExpressionV11Schemas() : { packageSchema: schema, lessonSchema };
  const beginnerRules = v11 ? `协议固定为1.1；curriculum.track=${track}，stage依据知识目录真实前置选择S0–S4。每课至少4项活动、至少1项讲解/示范及独立检查；词汇可为空。通过连续的短活动逐渐撤除提示，不新增嵌套步骤协议。音标课用sound_demo展示单音和对比，禁止假装语音识别；自然拼读用grapheme_build选择字母块，不能当作朗读证据；口头speaking_practice必须先隐藏范文，点击显示后才显示/播放，只记自练、不评分。课程知识目标必须引用目录ID，lesson内目标阶段与课程阶段一致。reviewActivities仅列可评估活动，不列口头自练。首期不产生综合掌握结论。` : '';
  return `你是英语口语教学课程编写助手。请根据我提供的教材/资料制作适合中文母语成人零基础学习者的课程候选内容。资料仅用于本次生成，不得伪造教材原文或引用页码。\n\n${beginnerRules}\n输出要求：只输出符合以下 JSON Schema 的一个 JSON 对象，不要 Markdown 代码围栏、解释或多余字段。音频素材由我另行提供：在 assets 中填写 assetId、mimeType、localFile 文件名；sha256 和 size 不要猜，留空不符合规范时请直接省略。缺少音频时在课内音频清单标记 needs_generation；不得伪造音频文件。先用 meaning_intro/micro_explanation 建立理解，再逐步减少提示，加入 sentence_build、substitution、listening_choice、independent_output 和 transfer_test。${v11 ? '每课至少4项活动。' : '至少7个活动；'}独立表达不能出现英文答案、首字母或可直接抄写的词块。迁移题用新情境，不重复前面完整示范答案。reviewActivities 提供至少两个独立练习组合。保留唯一 ID；所有接受答案显式列出，仅允许确实等价的自然表达。\n\n请先向我确认资料中不明确的目标、已知词汇和难度；确认后再生成。发现结构错误时仅返回修复后的完整 JSON。\n\n课程包 JSON Schema：\n${JSON.stringify(selectedSchemas.packageSchema, null, 2)}\n\n单课 JSON Schema：\n${JSON.stringify(selectedSchemas.lessonSchema, null, 2)}`;
}
