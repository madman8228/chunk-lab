(function(root){
  'use strict';
  const cloze=typeof module!=='undefined'?require('./sentence-cloze-engine.js'):root.JQKAClozeEngine;
  function validate(task){
    if(!task||task.version!==1||!task.nodes||!task.nodes[task.start])throw new Error('Invalid task start');
    const keys=new Set(Object.keys(task.initial));
    for(const node of Object.values(task.nodes)){
      if(node.exercise)cloze.validate(node.exercise);
      for(const transition of [...(node.actions||[]),...(node.success?[node.success]:[])]){
        if(!task.nodes[transition.to])throw new Error('Unknown task destination');
        if(Object.keys(transition.set||{}).some(key=>!keys.has(key)))throw new Error('Unknown state field');
        if(transition.earn&&!task.expressions[transition.earn])throw new Error('Unknown expression');
      }
      if(node.exercise&&!node.success)throw new Error('Exercise needs success transition');
      if(new Set((node.actions||[]).map(action=>action.id)).size!==(node.actions||[]).length)throw new Error('Duplicate action');
    }
    return task;
  }
  function start(task){validate(task);return {node:task.start,world:{...task.initial},earned:[],history:[]};}
  function move(task,state,transition){
    if(!transition)throw new Error('Action unavailable');
    return {...state,node:transition.to,world:{...state.world,...transition.set},earned:transition.earn?[...new Set([...state.earned,transition.earn])]:[...state.earned],history:[...state.history,state.node]};
  }
  function choose(task,state,id){return move(task,state,(task.nodes[state.node].actions||[]).find(action=>action.id===id));}
  function submit(task,state,values){
    const node=task.nodes[state.node];if(!node.exercise)throw new Error('No exercise here');
    const result=cloze.evaluate(node.exercise,values);
    return {result,state:result.correct?move(task,state,node.success):state};
  }
  const api={validate,start,choose,submit};root.JQKAActionEngine=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
