'use strict';
const Catalog = require('../../js/course-catalog');
const TOOLS = new Set(['vocabulary', 'chunks']);

function createWorkspaceOperations({ db, library, courseLibrary, vocabularyContent, upsertEntityRow, operationError }) {
  function ownsResource(userId, id) {
    if(id.startsWith('wordbook:personal-book:'))return !!library?.ownsPersonal?.(userId,id);
    if (!id.startsWith('course:')) return false;
    if (courseLibrary?.canRead?.(userId, id.slice(7))) return true;
    const userDecks = db.prepare('SELECT id,name,authoring_json FROM user_decks WHERE user_id=? AND deleted_at IS NULL').all(userId)
      .map(row => ({ id: row.id, name: row.name, items: [], authoring: row.authoring_json ? JSON.parse(row.authoring_json) : undefined }));
    const storyPackages = db.prepare('SELECT data_json FROM user_courses WHERE user_id=? AND deleted_at IS NULL').all(userId).map(row => JSON.parse(row.data_json));
    const logicalCourses = db.prepare("SELECT data_json FROM user_entity_rows WHERE user_id=? AND kind='logicalCourse' AND deleted_at IS NULL").all(userId).map(row => JSON.parse(row.data_json));
    const catalog = Catalog.buildCatalog({ manifest: { decks: [] }, userDecks, storyPackages, logicalCourses });
    return !!Catalog.getCourse(catalog, id.slice(7));
  }
  function apply(userId, body, seq) {
    if (body.type !== 'workspace.select') return null;
    const payload = body.payload || {};
    if (body.expected !== undefined || body.expectedRev !== undefined || Object.keys(payload).some(key => !['itemType', 'targetId', 'selected', 'position','bookId'].includes(key)) ||
      !['resource', 'tool','vocabulary-item'].includes(payload.itemType) || typeof payload.targetId !== 'string' || !/^[A-Za-z0-9:._-]{1,240}$/.test(payload.targetId) || typeof payload.selected !== 'boolean' ||
      (payload.itemType==='vocabulary-item'?typeof payload.bookId!=='string'||!/^[A-Za-z0-9:._-]{1,160}$/.test(payload.bookId):payload.bookId!==undefined)) {
      throw operationError('收藏操作格式无效', 'INVALID_OPERATION', 400);
    }
    const id = payload.itemType + ':' + (payload.itemType==='vocabulary-item'?JSON.stringify([payload.bookId,payload.targetId]):payload.targetId);
    const prior = db.prepare("SELECT data_json FROM user_entity_rows WHERE user_id=? AND kind='learningWorkspace' AND item_key=? AND deleted_at IS NULL").get(userId, id);
    if (payload.itemType === 'tool') {
      if (!TOOLS.has(payload.targetId) || payload.position != null && (!Number.isInteger(payload.position) || payload.position < 0 || payload.position > 2)) {
        throw operationError('练习工具或顺序无效', 'INVALID_OPERATION', 400);
      }
      const selected = db.prepare("SELECT data_json FROM user_entity_rows WHERE user_id=? AND kind='learningWorkspace' AND deleted_at IS NULL").all(userId)
        .map(row => JSON.parse(row.data_json)).filter(row => row.itemType === 'tool' && row.selected && row.targetId !== payload.targetId);
      if (payload.selected && selected.length >= 3) throw operationError('最多固定三个练习工具', 'WORKSPACE_TOOL_LIMIT', 409);
    } else if(payload.itemType==='vocabulary-item'){
      if(payload.position!==undefined)throw operationError('单词收藏不接受排序','INVALID_OPERATION',400);
      let available=false;try{available=!!vocabularyContent?.book(payload.bookId,userId)?.items.some(item=>item.itemId===payload.targetId);}catch(_){}
      if(!available&&(payload.selected||!prior))throw operationError('单词不存在或无权访问','RESOURCE_NOT_AVAILABLE',404);
    } else {
      if (payload.position !== undefined) throw operationError('收藏内容不接受工具排序', 'INVALID_OPERATION', 400);
      const publicResource = library && library.resources().some(resource => resource.resourceId === payload.targetId && resource.available);
      if (!(publicResource || ownsResource(userId, payload.targetId) || !payload.selected && prior)) {
        throw operationError('内容不存在或无权访问，收藏未更改', 'RESOURCE_NOT_AVAILABLE', 404);
      }
    }
    const value = { schemaVersion: 1, itemType: payload.itemType, targetId: payload.targetId, selected: payload.selected,
      position: payload.itemType === 'tool' ? payload.position || 0 : 0, updatedAt: Date.now(),...(payload.itemType==='vocabulary-item'?{bookId:payload.bookId}:{}) };
    upsertEntityRow(userId, 'learningWorkspace', id, value, seq);
    return { entity: 'learningWorkspace', id, rev: seq };
  }
  return { apply };
}
module.exports = { createWorkspaceOperations };
