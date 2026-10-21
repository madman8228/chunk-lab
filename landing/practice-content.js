(function(root){
  'use strict';
  // Declarative teaching data; no word-specific behavior in the engine or view.
  const lessons=[
  {
    "w": "decide",
    "meaning": "决定",
    "scene": "周末出游，你在徒步和野餐之间选择了野餐。",
    "example": "I decided to have a picnic.",
    "translation": "我决定去野餐。",
    "context": "已经发生的决定",
    "pattern": "decide to do something",
    "exercise": {
      "version": 1,
      "parts": [
        {
          "text": "I "
        },
        {
          "id": "verb",
          "label": "决定（过去式）",
          "answers": [
            "decided"
          ],
          "feedback": [
            {
              "values": [
                "decide"
              ],
              "message": "这里说已经发生的决定，用过去式 decided。"
            }
          ]
        },
        {
          "text": " "
        },
        {
          "id": "link",
          "label": "决定做某事的连接词",
          "answers": [
            "to"
          ]
        },
        {
          "text": " have a picnic."
        }
      ]
    }
  },
  {
    "w": "borrow",
    "meaning": "借入",
    "scene": "手机没电了，你向朋友借充电器，用完归还。",
    "example": "Can I borrow your charger?",
    "translation": "我可以借你的充电器吗？",
    "pattern": "Can I borrow something?",
    "exercise": {
      "version": 1,
      "parts": [
        {
          "text": "Can I "
        },
        {
          "id": "verb",
          "label": "借入",
          "answers": [
            "borrow"
          ],
          "feedback": [
            {
              "values": [
                "lend"
              ],
              "message": "向别人借入用 borrow；lend 是借出。"
            }
          ]
        },
        {
          "text": " your charger?"
        }
      ]
    }
  },
  {
    "w": "advice",
    "meaning": "建议",
    "scene": "你正在准备面试，朋友给你建议，你向她道谢。",
    "example": "Thanks for your advice about the interview.",
    "translation": "谢谢你关于面试的建议。",
    "pattern": "Thanks for your advice",
    "exercise": {
      "version": 1,
      "parts": [
        {
          "text": "Thanks "
        },
        {
          "id": "link",
          "label": "感谢某事的介词",
          "answers": [
            "for"
          ]
        },
        {
          "text": " your "
        },
        {
          "id": "noun",
          "label": "建议",
          "answers": [
            "advice"
          ],
          "feedback": [
            {
              "values": [
                "advices"
              ],
              "message": "advice 是不可数名词，不加 s。"
            },
            {
              "values": [
                "advise"
              ],
              "message": "这里需要名词 advice；advise 是动词。"
            }
          ]
        },
        {
          "text": " about the interview."
        }
      ]
    }
  },
  {
    "w": "avoid",
    "meaning": "避开",
    "scene": "前方堵车，你选择安静的小路，避开繁忙的道路。",
    "example": "I avoid the busy road.",
    "translation": "我避开这条繁忙的道路。",
    "pattern": "avoid something",
    "exercise": {
      "version": 1,
      "parts": [
        {
          "text": "I "
        },
        {
          "id": "verb",
          "label": "避开",
          "answers": [
            "avoid"
          ]
        },
        {
          "text": " the busy road."
        }
      ]
    }
  },
  {
    "w": "explain",
    "meaning": "解释",
    "scene": "第一次玩桌游，你请朋友给你解释规则。",
    "example": "Can you explain the rules to me?",
    "translation": "你能给我解释一下规则吗？",
    "pattern": "explain something to someone",
    "exercise": {
      "version": 1,
      "parts": [
        {
          "text": "Can you "
        },
        {
          "id": "verb",
          "label": "解释",
          "answers": [
            "explain"
          ]
        },
        {
          "text": " the rules "
        },
        {
          "id": "link",
          "label": "向某人解释的介词",
          "answers": [
            "to"
          ]
        },
        {
          "text": " me?"
        }
      ]
    }
  },
  {
    "w": "enough",
    "meaning": "足够的",
    "scene": "野餐前，你准备了足够大家喝的水。",
    "example": "We have enough water for everyone.",
    "translation": "我们有足够的水给大家喝。",
    "pattern": "enough + noun",
    "exercise": {
      "version": 1,
      "parts": [
        {
          "text": "We have "
        },
        {
          "id": "quantity",
          "label": "足够的",
          "answers": [
            "enough"
          ]
        },
        {
          "text": " water for everyone."
        }
      ]
    }
  }
];
  function select(progress,now){
    const due=lessons.filter(lesson=>progress[lesson.w]&&progress[lesson.w].dueAt<=now).sort((a,b)=>progress[a.w].dueAt-progress[b.w].dueAt);
    const fresh=lessons.filter(lesson=>!progress[lesson.w]);
    const picked=due.slice(0,3).concat(fresh.slice(0,3));
    for(const lesson of due.concat(fresh))if(picked.length<6&&!picked.includes(lesson))picked.push(lesson);
    return picked;
  }
  const api={lessons,select};root.JQKAPracticeContent=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
