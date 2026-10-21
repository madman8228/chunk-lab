(function(){
  'use strict';
  const $=id=>document.getElementById(id),node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  const state=WordbookWorkbenchState.create({schemaVersion:1,book:{bookId:'book-'+crypto.randomUUID(),title:'',catalog:{facets:{}},units:[]},items:[]});
  let preview=null;
  const status=text=>{$('draftStatus').textContent=text;};
  function applyDraft(value){state.applyDraft(value);preview?.destroy?.();preview=null;$('draftPreview').hidden=true;window.dispatchEvent(new CustomEvent('wordbook-draft-change'));}
  function tryItem(item){try{
    JQKAClozeEngine.validate(item.exercise);preview?.destroy?.();const root=$('previewRoot');root.replaceChildren(node('h3',item.word+' · '+item.meaning),node('p',item.translation));
    if(item.guidedSteps){VocabularyCourseContract.validateGuidedActivity(item,{schemaVersion:1,revision:'a'.repeat(64),steps:item.guidedSteps},JQKAClozeEngine);preview=GuidedSentenceView.create(item,item.guidedSteps,{onComplete:()=>status('试学完成，没有保存学习记录。')});}
    else preview=JQKAClozeView.create(item.exercise,{onComplete:()=>status('试学完成，没有保存学习记录。')});
    root.append(preview.element);$('draftPreview').hidden=false;status('仅试学，不保存学习记录。');$('draftPreview').scrollIntoView({block:'start'});preview.focus();
  }catch(error){status(error.message);}}
  window.WordbookWorkbench={snapshot:state.snapshot,previewItem:tryItem,markSaved:state.markSaved,applyDraft};
  window.addEventListener('beforeunload',event=>{if(state.isDirty()){event.preventDefault();event.returnValue='';}});
})();
