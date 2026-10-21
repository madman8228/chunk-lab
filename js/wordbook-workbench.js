/* DOM-independent draft state. Preserve every field in recovered course assets. */
(function(global){
  'use strict';
  const copy=value=>JSON.parse(JSON.stringify(value));
  function create(initial){
    let draft=copy(initial),dirty=false;
    function applyDraft(value){
      if(value?.schemaVersion!==1||!value.book||!Array.isArray(value.book.units)||!Array.isArray(value.items)||value.items.some(item=>!item||typeof item!=='object')||value.book.units.some(unit=>!unit||typeof unit!=='object'))throw Error('草稿结构无效');
      const next=copy(value);draft=next;dirty=true;
    }
    return {snapshot:()=>copy(draft),applyDraft,markSaved:()=>{dirty=false;},isDirty:()=>dirty};
  }
  const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else global.WordbookWorkbenchState=api;
})(typeof window==='object'?window:globalThis);
