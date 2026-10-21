(function(root){
  'use strict';
  const cloze=typeof module!=='undefined'?require('./sentence-cloze-engine.js'):root.JQKAClozeEngine;
  function prepare(exercise){
    cloze.validate(exercise);const tokens=[],groups=[];
    if(exercise.candidates!==undefined&&(!Array.isArray(exercise.candidates)||exercise.candidates.some(word=>typeof word!=='string'||! /^[a-z]+(?:['’-][a-z]+)*$/i.test(word))))throw new Error('Candidates must be English words');
    exercise.parts.forEach((part,group)=>{
      const words=(Object.hasOwn(part,'text')?part.text:part.answers[0]).trim().split(/\s+/).filter(Boolean);
      const indices=[];
      words.forEach((value,index)=>{
        const match=value.match(/^([a-z]+(?:['’-][a-z]+)*)([.,!?]*)$/i);if(!match)throw new Error('Initials mode requires English word tokens');
        const answers=Object.hasOwn(part,'text')?[match[1]]:part.answers.map(answer=>answer.trim().split(/\s+/)[index]?.replace(/[.,!?]+$/,'')).filter(Boolean);
        const id='slot-'+tokens.length;indices.push(tokens.length);
        tokens.push({id,word:match[1],punctuation:match[2],answers,group,sourceId:part.id||null,label:(exercise.annotations?.[group]||part.label||'意群')+' · 第'+(index+1)+'个词',feedback:part.feedback||[]});
      });
      groups.push({indices,meaning:exercise.annotations?.[group]||''});
    });
    const vocabulary=[...new Map([...tokens.flatMap(token=>token.answers),...(exercise.candidates||[])].map(word=>[word.toLowerCase(),word])).values()];
    return {tokens,groups,vocabulary};
  }
  function candidates(model,letter){return model.vocabulary.filter(word=>word[0].toLowerCase()===letter.toLowerCase());}
  function start(model,saved){return {active:Math.min(model.tokens.length-1,Math.max(0,saved?.active||0)),words:model.tokens.map((token,index)=>saved?.words?.[index]||'')};}
  function input(model,state,key){
    const next={active:state.active,words:[...state.words]};
    if(key==='Backspace'){if(!next.words[next.active]&&next.active>0)next.active--;next.words[next.active]='';return {state:next};}
    if(key===' '||key==='Enter'){if(next.words[next.active]&&next.active<model.tokens.length-1)next.active++;return {state:next};}
    if(!/^[a-z]$/i.test(key))return {state,message:'请输入英文首字母。'};
    const options=candidates(model,key);if(!options.length)return {state,message:'这一句没有以 '+key.toUpperCase()+' 开头的候选词。'};
    const current=next.words[next.active];
    if(current&&current[0].toLowerCase()!==key.toLowerCase()){
      if(next.active===model.tokens.length-1)return {state,message:'句子已填完，可以提交或点选单词修改。'};
      next.active++;next.words[next.active]=options[0];
    }else next.words[next.active]=options[(options.findIndex(word=>word.toLowerCase()===current.toLowerCase())+1)%options.length];
    return {state:next};
  }
  function evaluate(model,state){
    const fields=model.tokens.map((token,index)=>{
      const value=cloze.normalize(state.words[index]);const correct=token.answers.some(answer=>cloze.normalize(answer)===value);
      const rule=token.feedback.find(rule=>rule.values.some(answer=>cloze.normalize(answer)===value));
      return {id:token.id,state:correct?'correct':value?'incorrect':'empty',message:correct?'':rule?.message||(value?'这个词不适合当前位置，请切换候选。':'请补上这个词。')};
    });
    const values={};for(const token of model.tokens)if(token.sourceId)values[token.sourceId]=model.tokens.filter(item=>item.sourceId===token.sourceId).map(item=>state.words[model.tokens.indexOf(item)]).join(' ');
    return {correct:fields.every(field=>field.state==='correct'),fields,firstInvalid:fields.find(field=>field.state!=='correct')?.id||null,values};
  }
  const api={prepare,candidates,start,input,evaluate};root.JQKAInitialsEngine=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
