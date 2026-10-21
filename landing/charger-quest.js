(function(root){
  'use strict';
  function gap(before,after,word,label,feedback=[]){return {version:1,parts:[{text:before},{id:'word',label,answers:[word],feedback},{text:after}]};}
  const task={version:1,id:'charger',title:'借充电器',goal:'',start:'borrow',
    image:{webp:'assets/vocabulary-borrow-wide-v3.webp',alt:'手机没电的女孩向朋友借充电线'},
    initial:{battery:2,holder:'朋友',connection:'尚未接通',route:'未选择'},
    expressions:{borrow:'Can I borrow your charger?',buy:'Can I buy a charger?',enough:'I have enough battery to call.',lend:'I can lend you the charger.'},
    nodes:{
      arrival:{speaker:'你',line:'手机只剩 2% 电。朋友还在等我的电话……',prompt:'先解决电量问题。',actions:[{id:'borrow',label:'向身边的朋友借',detail:'用完归还',to:'borrow'},{id:'buy',label:'去附近商店买',detail:'买一个自己的',to:'buy'}]},
      borrow:{learning:{word:'borrow',phonetic:'/ˈbɒrəʊ/',meaning:'借入 · 向别人借',example:'Can I borrow your charger?',translation:'我能借用你的充电器吗？'},speaker:'You',line:'Can I borrow your charger?',prompt:'补上“借入”，向朋友借充电器。',exercise:gap('Can I ',' your charger?','borrow','借入',[{values:['lend'],message:'朋友：你是想借给我吗？我有充电器。borrow 是向别人借，lend 是借给别人。'}]),success:{to:'charged',set:{battery:24,holder:'你（借用）',route:'借用'},earn:'borrow'}},
      buy:{speaker:'店员',line:'这里有充电器，买好后可以在店里充电。',prompt:'问店员：我能买一个充电器吗？',exercise:gap('Can I ',' a charger?','buy','购买'),success:{to:'charged',set:{battery:24,holder:'你（自有）',route:'购买'},earn:'buy'}},
      charged:{learning:{word:'enough',phonetic:'/ɪˈnʌf/',meaning:'足够',example:'I have enough battery to call.',translation:'我的电量足够打电话了。'},speaker:'Friend',line:'Here you go.（给你。）',prompt:'补上“足够”，然后给朋友打电话。',exercise:gap('I have ',' battery to call.','enough','足够'),success:{to:'lend',set:{connection:'电话已接通'},earn:'enough'}},
      lend:{learning:{word:'lend',phonetic:'/lend/',meaning:'借出 · 借给别人',example:'I can lend you the charger.',translation:'我可以把充电器借给你。'},speaker:'Xiaolin',line:'Can you help me?（能帮我一下吗？）',prompt:'补上“借出”，把充电器借给小林。',exercise:gap('I can ',' you the charger.','lend','借出',[{values:['borrow'],message:'小林：你要向我借？可是我没有充电器。现在是你借给他，用 lend。'}]),success:{to:'helped',set:{holder:'小林（借用）'},earn:'lend'}},
      helped:{speaker:'小林',line:'谢谢！用完我会还回来。',prompt:'电话接通了，充电器也帮到了另一个人。',terminal:true}
    }};
  task.nodes.borrow.exercise.annotations=['我能','借入','你的充电器'];
  task.nodes.borrow.exercise.candidates=['lend'];
  task.nodes.buy.exercise.annotations=['我能','买','一个充电器'];
  task.nodes.charged.exercise.annotations=['我有','足够的','打电话所需的电量'];
  task.nodes.lend.exercise.parts.splice(2,1,{text:' you '},{text:'the charger.'});
  task.nodes.lend.exercise.annotations=['我可以','借给','你','这个充电器'];
  root.JQKAChargerQuest=task;if(typeof module!=='undefined')module.exports=task;
})(typeof window!=='undefined'?window:globalThis);
