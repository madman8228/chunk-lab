(function(root){
  'use strict';
  function normalize(value){return String(value??'').trim().toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').replace(/[.!?。！？]+$/,'').trim();}
  function blanks(exercise){return exercise.parts.filter(part=>!Object.hasOwn(part,'text'));}
  function validate(exercise){
    if(!exercise||exercise.version!==1||!Array.isArray(exercise.parts))throw new Error('Invalid cloze exercise version or parts');
    const ids=new Set();
    for(const part of exercise.parts){
      if(!part||typeof part!=='object')throw new Error('Invalid sentence part');
      if(Object.hasOwn(part,'text')){if(typeof part.text!=='string'||Object.hasOwn(part,'id'))throw new Error('Text parts cannot be blanks');continue;}
      if(typeof part.id!=='string'||!part.id||ids.has(part.id))throw new Error('Blank IDs must be unique');
      ids.add(part.id);
      if(typeof part.label!=='string'||!part.label||!Array.isArray(part.answers)||!part.answers.length||part.answers.some(answer=>typeof answer!=='string'||!normalize(answer)))throw new Error('Blank needs a label and accepted answers');
      if(part.feedback!==undefined&&(!Array.isArray(part.feedback)||part.feedback.some(rule=>!Array.isArray(rule.values)||rule.values.some(value=>typeof value!=='string')||typeof rule.message!=='string')))throw new Error('Invalid blank feedback');
    }
    if(!ids.size)throw new Error('Exercise must have at least one blank');
    if(exercise.annotations!==undefined&&(!Array.isArray(exercise.annotations)||exercise.annotations.length!==exercise.parts.length||exercise.annotations.some(value=>typeof value!=='string'||!value.trim())))throw new Error('Annotations must match every sentence group');
    if(exercise.glosses!==undefined){
      const count=exercise.parts.reduce((n,part)=>n+(Object.hasOwn(part,'text')?(part.text.match(/\S+/g)||[]).length:1),0);
      if(!Array.isArray(exercise.glosses)||exercise.glosses.length!==count||exercise.glosses.some(gloss=>typeof gloss!=='string'||!gloss.trim()))throw new Error('Glosses must match every sentence token');
    }
    return exercise;
  }
  function evaluate(exercise,values={}){
    validate(exercise);
    const fields=blanks(exercise).map(part=>{
      const value=normalize(values[part.id]);
      if(!value)return {id:part.id,state:'empty',message:'请补上“'+part.label+'”。'};
      if(part.answers.some(answer=>normalize(answer)===value))return {id:part.id,state:'correct',message:''};
      const rule=(part.feedback||[]).find(rule=>rule.values.some(answer=>normalize(answer)===value));
      return {id:part.id,state:'incorrect',message:rule?rule.message:'检查“'+part.label+'”的拼写或形式，再试一次。'};
    });
    return {correct:fields.every(field=>field.state==='correct'),fields,firstInvalid:fields.find(field=>field.state!=='correct')?.id||null};
  }
  function sentence(exercise,values){return exercise.parts.map(part=>Object.hasOwn(part,'text')?part.text:(values?String(values[part.id]??''):part.answers[0])).join('');}
  const api={normalize,blanks,validate,evaluate,sentence};root.JQKAClozeEngine=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
