import { selectTools } from './tools.mjs';
export function buildHomeModel({ resources = [], memberships = {}, preferences = {}, resume = null, due = 0, status = 'ready' } = {}) {
  const joined = resources.filter(resource => resource.courseId && memberships[resource.courseId]?.joined);
  joined.sort((a, b) => (memberships[b.courseId].changedAt || 0) - (memberships[a.courseId].changedAt || 0));
  return { status, resume, due: Math.max(0, Number(due) || 0), active: joined.slice(0, 3), ...selectTools(preferences) };
}
