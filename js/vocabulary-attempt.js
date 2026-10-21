/* Process evidence only. Never awards completion or mastery. */
(function(root){
 'use strict';
 function evaluate(item,payload,{engine,guidedContent}){
  const {practiceType,inputMode,answers,stepIndex}=payload;
  const check=(ok,message)=>{if(!ok)throw Error(message);};
  check(answers&&typeof answers==='object'&&!Array.isArray(answers),'作答内容无效');
  let correct;
  if(practiceType==='guided-expression'){
   const steps=guidedContent.forItem(item);check(steps&&Number.isSafeInteger(stepIndex)&&stepIndex>=0&&stepIndex<steps.length,'引导步骤无效');
   check(['typing','chunks'].includes(inputMode)&&Object.keys(answers).length===1&&typeof answers.text==='string'&&answers.text.trim()&&answers.text.length<=200,'引导作答格式无效');
   if(inputMode==='chunks')check(steps[stepIndex].choices.includes(answers.text),'引导选项不存在');
   correct=engine.normalize(answers.text)===engine.normalize(steps[stepIndex].answer);
  }else{
   check(stepIndex===undefined,'当前练习没有引导步骤');
   if(practiceType==='word-choice'){
    check(inputMode==='choice'&&Object.keys(answers).length===1&&item.learning?.wordChoice?.options.some(option=>option.id===answers.optionId),'选词作答无效');correct=answers.optionId===item.learning.wordChoice.correctOptionId;
   }else if(practiceType==='chunk-order'){
    const activity=item.learning?.chunkOrder,ids=answers.chunkIds;check(inputMode==='chunks'&&Object.keys(answers).length===1&&activity&&Array.isArray(ids)&&ids.length===activity.chunks.length&&new Set(ids).size===ids.length&&ids.every(id=>activity.chunks.some(chunk=>chunk.id===id)),'拼块作答无效');correct=ids.every((id,index)=>id===activity.correctOrder[index]);
   }else if(practiceType==='word-dictation'){
    check(inputMode==='typing'&&Object.keys(answers).length===1&&typeof answers.word==='string'&&answers.word.trim()&&answers.word.length<=200&&item.learning?.wordDictation,'听写作答无效');correct=item.learning.wordDictation.answers.some(answer=>engine.normalize(answer)===engine.normalize(answers.word));
   }else{
    check(practiceType==='sentence-cloze'&&inputMode==='typing','当前练习不支持作答过程记录');const blanks=engine.blanks(item.exercise);check(Object.keys(answers).length===blanks.length&&blanks.every(blank=>typeof answers[blank.id]==='string'&&answers[blank.id].trim()&&answers[blank.id].length<=200),'句子作答格式无效');correct=engine.evaluate(item.exercise,answers).correct;
   }
  }
  return {correct,assessment:false,completion:false,evidence:'server-evaluated-answer'};
 }
 const api={evaluate};root.VocabularyAttempt=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
