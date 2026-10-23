import { fingerprint } from './model.mjs';

const stageGrades = {
  '小学': ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'],
  // Six-year junior entry is possible in the five-four schooling system.
  '初中': ['六年级', '七年级', '八年级', '九年级'],
  '高中': ['高一', '高二', '高三']
};
const clean = value => typeof value === 'string' && value === value.trim() && value.length > 0 && value.length <= 100 && !/[<>\u0000-\u001f]/.test(value);

// Explicit verified metadata only: never guess a textbook from a title or word list.
// Series distinguishes PEP/精通/entry year/schooling system within one publisher.
export function textbookFacets(profile) {
  if (!profile || Object.keys(profile).some(key => !['schoolStage','publisherId','seriesId','textbookVersion','edition','grade','volume'].includes(key))) throw new Error('教材分类字段无效');
  if (profile.textbookVersion !== undefined && !clean(profile.textbookVersion)) throw new Error('教材版本简称无效');
  if (!Object.hasOwn(stageGrades,profile.schoolStage)) throw new Error('教材学段需为小学、初中或高中');
  for (const key of ['publisherId','seriesId','edition','volume']) if (!clean(profile[key])) throw new Error('请先核实教材的版本、系列、版次与册次');
  if (/待核|未知|未确认|最新版/.test(profile.edition)) throw new Error('教材版次必须是已经核实的明确版次，不能使用待核或最新版');
  if (profile.grade != null && !stageGrades[profile.schoolStage].includes(profile.grade)) throw new Error('年级与学段不一致');
  if (profile.schoolStage !== '高中') {
    if (!profile.grade) throw new Error('小学和初中教材需明确年级');
    if (!['上册','下册','全一册'].includes(profile.volume)) throw new Error('小学和初中册次需为上册、下册或全一册');
  } else if (!/^(?:必修|选择性必修|选修)\s*.+/.test(profile.volume)) throw new Error('高中教材保留必修、选择性必修或选修的原册名，不能强行使用上下册');
  return {
    schoolStages: [profile.schoolStage], grades: profile.grade ? [profile.grade] : [],
    publisherId: profile.publisherId, seriesId: profile.seriesId,
    edition: profile.edition, volume: profile.volume,
    ...(profile.textbookVersion === undefined ? {} : { textbookVersion: profile.textbookVersion })
  };
}

export async function textbookBookId(profile) {
  const facets = textbookFacets(profile);
  const { textbookVersion, ...identity } = facets;
  return 'textbook-wordbook:' + (await fingerprint(identity)).slice(0, 32);
}
