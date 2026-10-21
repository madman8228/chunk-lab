/* Teaching overlays only; source course exercises and revisions remain unchanged. */
(function(g){
 'use strict';
 const step=(prompt,answer,others,field)=>({prompt,answer,choices:[answer,...others],field});
 const plans={
  'pilot-v1:borrow':[
   step('我可以……吗？','Can I',['I can','Can you']),step('借入','borrow',['lend','keep'],'verb'),step('你的','your',['my','their']),step('充电器','charger?',['phone?','battery?'])
  ],
  'pilot-v1:decide':[
   step('我','I',['We','You']),step('决定（已经发生）','decided',['decide','deciding'],'verb'),step('接下来表达“去做某事”','to',['for','at'],'link'),step('去野餐','have a picnic.',['have a meeting.','take a walk.'])
  ],
  'pilot-v1:advice':[
   step('谢谢','Thanks',['Sorry','Hello']),step('因为……而感谢','for',['to','at'],'link'),step('你的','your',['my','our']),step('建议（不可数）','advice',['advices','advise'],'noun'),step('关于面试','about the interview.',['before the interview.','after the interview.'])
  ],
  'pilot-v1:avoid':[
   step('我','I',['We','They']),step('避开','avoid',['visit','approach'],'verb'),step('这条繁忙的道路','the busy road.',['the quiet road.','a busy room.'])
  ],
  'pilot-v1:enough':[
   step('我们有','We have',['We need','They have']),step('足够的','enough',['many','little'],'quantity'),step('水','water',['food','juice']),step('给大家','for everyone.',['with everyone.','from everyone.'])
  ],
  'pilot-v1:explain':[
   step('你能……吗？','Can you',['You can','Can I']),step('解释','explain',['describe','repeat'],'verb'),step('规则','the rules',['the plans','the roads']),step('向（某人）','to',['for','with'],'link'),step('我','me?',['you?','them?'])
  ]
 };
 function forItem(item){
  if(item.learning!==undefined){
   const contract=g.VocabularyCourseContract||(typeof require==='function'?require('../js/vocabulary-course-contract.js'):null);
   const engine=g.JQKAClozeEngine;
   if(!contract)throw Error('教学格式模块未加载');
   contract.validateLearning(item,engine);
   const activity=item.learning.guidedExpression;
   return activity?activity.steps.map(s=>({...s,choices:s.choices.slice()})):null;
  }
  const plan=plans[item.itemId];if(!plan)return null;
  const engine=g.JQKAClozeEngine;
  const expected=engine.sentence(item.exercise);
  if(engine.normalize(plan.map(s=>s.answer).join(' '))!==engine.normalize(expected))return null;
  const fields=engine.blanks(item.exercise);
  if(fields.length!==plan.filter(s=>s.field).length||fields.some(field=>!plan.some(s=>s.field===field.id&&field.answers.some(a=>engine.normalize(a)===engine.normalize(s.answer)))))return null;
  return plan.map(s=>({...s,choices:s.choices.slice()}));
 }
 g.GuidedSentenceContent={forItem};
 if(typeof module!=='undefined')module.exports=g.GuidedSentenceContent;
})(typeof window!=='undefined'?window:globalThis);
