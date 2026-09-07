/* builtins.js · Chunk Lab 内置题库
   builtin-daily = 原 日常对话(30) + 购物英语(28) = 58 句（2026-09-06）
   + 口语·口头禅(30) = 88 句静态（2026-09-07 方案 A：口头禅并入日常对话）
   运行时 oral8000.js 再并入 50 句（原日常进阶）→ 共 138 句
   builtin-freq-idioms 由 freq-idioms.js 文件尾自注册，不在此文件 */
window.BUILTIN = [
  {
    "id": "builtin-daily",
    "builtin": true,
    "name": "日常对话 · Daily Talk",
    "desc": "生活口语综合 138 句：寒暄/邀约/客套/道歉/聊近况 + 购物 + 口头禅 + 进阶表达",
    "items": [
      {
        "sentence": "How was your weekend?",
        "cid": "77588aab",
        "translation": "你周末过得怎么样？",
        "chunks": [
          "How was",
          "your weekend?"
        ],
        "hints": [
          "……怎么样",
          "你的周末"
        ],
        "grammar": [
          {
            "role": "状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/haʊ/",
              "/wɒz/"
            ],
            "pos": "疑问词组",
            "meaning": "怎么样"
          },
          {
            "role": "主语",
            "color": "#c87033",
            "phonetic": [
              "/jɔːr/",
              "/ˈwiːkend/"
            ],
            "pos": "名词短语",
            "meaning": "你的周末"
          }
        ],
        "explanations": [
          "\"How is your weekend?\" 问的是\"现在怎么样\"，但周末已经过去了，要用过去式 **was**。",
          "这里特指\"你刚过去的那个周末\"，所以用 **your**。如果说\"周末通常怎么样？\"才用 \"the weekend\" 或 \"weekends\"。"
        ]
      },
      {
        "sentence": "I'm going to meet a friend for lunch.",
        "cid": "cff80fb6",
        "translation": "我打算和朋友一起吃午饭。",
        "chunks": [
          "I'm going to",
          "meet a friend",
          "for lunch."
        ],
        "hints": [
          "我打算",
          "见一个朋友",
          "一起吃午饭"
        ],
        "grammar": [
          {
            "role": "主语+谓语",
            "color": "#c87033",
            "phonetic": [
              "/aɪm/",
              "/ˈɡəʊɪŋ/",
              "/tuː/"
            ],
            "pos": "主谓结构",
            "meaning": "我打算"
          },
          {
            "role": "谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/miːt/",
              "/ə/",
              "/frend/"
            ],
            "pos": "动词短语",
            "meaning": "见一个朋友"
          },
          {
            "role": "目的状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/fɔːr/",
              "/lʌntʃ/"
            ],
            "pos": "介词短语",
            "meaning": "为了午餐"
          }
        ],
        "explanations": [
          "**be going to** 表示\"计划、打算做某事\"。常见错误：\n• \"I will going\" → will 后面不能加 ing\n• \"I go to meet\" → 缺少 be going to 结构，语气也不够自然",
          "**meet** 是原形动词，因为前面有 \"going to\" 搭配。不要写成 \"meeting\"（那需要 am going to meeting，重复了）。",
          "**for + 名词** 表示目的。这里 for lunch = 为了吃午餐。不要用 \"to lunch\"（to 后面要接动词原形）。"
        ]
      },
      {
        "sentence": "Could you tell me how to get to the station?",
        "cid": "4226408e",
        "translation": "你能告诉我怎么去车站吗？",
        "chunks": [
          "Could you tell me",
          "how to get",
          "to the station?"
        ],
        "hints": [
          "你能告诉我吗",
          "怎么去",
          "到车站"
        ],
        "grammar": [
          {
            "role": "主句谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/kʊd/",
              "/juː/",
              "/tel/",
              "/miː/"
            ],
            "pos": "情态动词+宾语",
            "meaning": "你能告诉我"
          },
          {
            "role": "宾语从句",
            "color": "#3358e0",
            "phonetic": [
              "/haʊ/",
              "/tuː/",
              "/ɡet/"
            ],
            "pos": "不定式短语",
            "meaning": "怎么去"
          },
          {
            "role": "方向状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/tuː/",
              "/ðə/",
              "/ˈsteɪʃn/"
            ],
            "pos": "介词短语",
            "meaning": "到车站"
          }
        ],
        "explanations": [
          "**Could you tell me...** 是委婉的请求句型。常见错误：\n• \"Could you **say** me\" → say 后面不直接接人，要用 tell\n• \"Can you tell me\" → 也可以，但 Could 更礼貌",
          "**how to get** 是\"疑问词 + 不定式\"结构，作 tell 的宾语。不要写成 \"how can I get\"（那是宾语从句，语法上也可以但不定式更简洁）。",
          "**to the station** 中 **the** 不能省略——说话双方都知道指的是哪个车站（特指）。"
        ]
      },
      {
        "sentence": "I haven't seen you for ages.",
        "cid": "78b2ed9c",
        "translation": "好久不见了。",
        "chunks": [
          "I haven't seen you",
          "for ages."
        ],
        "hints": [
          "我没见到你",
          "有很久了"
        ],
        "grammar": [
          {
            "role": "谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/aɪ/",
              "/ˈhævnt/",
              "/siːn/",
              "/juː/"
            ],
            "pos": "现在完成时",
            "meaning": "我没见到你"
          },
          {
            "role": "时间状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/fɔːr/",
              "/ˈeɪdʒɪz/"
            ],
            "pos": "介词短语",
            "meaning": "很久"
          }
        ],
        "explanations": [
          "**现在完成时**（have/has + 过去分词）表示\"从过去持续到现在的状态\"。常见错误：\n• \"I **didn't** see you\" → 一般过去时只强调过去，不含\"到现在\"的意思\n• \"I **don't** see you\" → 一般现在时表示习惯，不符合\"好久不见\"",
          "**for + 时间段** 表示持续了多久。常见错误：\n• \"**since** ages\" → since 后接时间点（如 since 2020），不是时间段\n• \"for **age**\" → ages 用复数，表示\"许多年、很久\""
        ]
      },
      {
        "sentence": "Sorry, I didn't catch what you said.",
        "cid": "67ae602e",
        "translation": "抱歉，我没听清你说的话。",
        "chunks": [
          "Sorry,",
          "I didn't catch",
          "what you said."
        ],
        "hints": [
          "抱歉",
          "我没听清",
          "你说的话"
        ],
        "grammar": [
          {
            "role": "插入语",
            "color": "#7c5cbf",
            "phonetic": [
              "/ˈsɒri/"
            ],
            "pos": "感叹词",
            "meaning": "抱歉"
          },
          {
            "role": "主句谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/aɪ/",
              "/ˈdɪdnt/",
              "/kætʃ/"
            ],
            "pos": "一般过去时否定",
            "meaning": "我没听清"
          },
          {
            "role": "宾语从句",
            "color": "#3358e0",
            "phonetic": [
              "/wɒt/",
              "/juː/",
              "/sed/"
            ],
            "pos": "名词性从句",
            "meaning": "你说的话"
          }
        ],
        "explanations": [
          "这里 **Sorry** 是独立的礼貌用语，后面用逗号隔开。也可以说 \"Excuse me\" 或 \"Pardon\"。",
          "**一般过去时的否定**：didn't + 动词原形。常见错误：\n• \"I **don't** catch\" → 时态错了，事情已经发生\n• \"I didn't **caught**\" → caught 是过去分词，didn't 后面要用原形 catch",
          "**catch 后面的宾语从句用陈述语序**（主语 + 谓语），不是疑问语序。常见错误：\n• \"what **did you** say\" → 这是直接疑问句的语序，从句里要还原成 \"you said\""
        ]
      },
      {
        "sentence": "Let's grab a coffee after work.",
        "cid": "f03e78e8",
        "translation": "下班后一起去喝杯咖啡吧。",
        "chunks": [
          "Let's grab a coffee",
          "after work."
        ],
        "hints": [
          "我们去喝杯咖啡",
          "下班之后"
        ],
        "grammar": [
          {
            "role": "祈使主谓",
            "color": "#e74c7a",
            "phonetic": [
              "/lets/",
              "/ɡræb/",
              "/ə/",
              "/ˈkɒfi/"
            ],
            "pos": "let's + 动词",
            "meaning": "我们去喝咖啡"
          },
          {
            "role": "时间状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/ˈɑːftər/",
              "/wɜːrk/"
            ],
            "pos": "介词短语",
            "meaning": "下班后"
          }
        ],
        "explanations": [
          "**Let's = Let us**，表示建议或邀请。常见错误：\n• 写成 **Let us** → 太正式，口语用 Let's\n• **grab** 在这里不是'抓'，是口语化的'去吃/去喝'",
          "**work** 作'上班'讲时是不可数名词，不加 the。常见错误：\n• after **the** work → 错误\n• after **working** → 语法正确但 after work 更简洁常用"
        ]
      },
      {
        "sentence": "It looks like it's going to rain.",
        "cid": "05de33a5",
        "translation": "看起来快要下雨了。",
        "chunks": [
          "It looks like",
          "it's going to rain."
        ],
        "hints": [
          "看起来",
          "要下雨了"
        ],
        "grammar": [
          {
            "role": "主句主谓",
            "color": "#c87033",
            "phonetic": [
              "/ɪt/",
              "/lʊks/",
              "/laɪk/"
            ],
            "pos": "主系表结构",
            "meaning": "看起来"
          },
          {
            "role": "真正主语",
            "color": "#3358e0",
            "phonetic": [
              "/ɪts/",
              "/ˈɡəʊɪŋ/",
              "/tuː/",
              "/reɪn/"
            ],
            "pos": "不定式短语",
            "meaning": "要下雨了"
          }
        ],
        "explanations": [
          "**It looks like...** 表示「看起来好像……」。常见错误：\n• \"It **look** like\" → 第三人称单数要加 s\n• \"It **seems** like\" → 也可以，但 seems 更正式",
          "**be going to** 表示基于现有迹象的预测（看到乌云→要下雨）。与 **will** 的区别：will 是主观判断，be going to 是有客观依据的预测。"
        ]
      },
      {
        "sentence": "Do you mind if I open the window?",
        "cid": "70190b47",
        "translation": "你介意我开下窗吗？",
        "chunks": [
          "Do you mind",
          "if I open",
          "the window?"
        ],
        "hints": [
          "你介意吗",
          "如果我打开",
          "窗户"
        ],
        "grammar": [
          {
            "role": "主句谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/duː/",
              "/juː/",
              "/maɪnd/"
            ],
            "pos": "一般疑问句",
            "meaning": "你介意吗"
          },
          {
            "role": "条件从句",
            "color": "#7c5cbf",
            "phonetic": [
              "/ɪf/",
              "/aɪ/",
              "/ˈəʊpən/"
            ],
            "pos": "条件状语从句",
            "meaning": "如果我打开"
          },
          {
            "role": "宾语",
            "color": "#3358e0",
            "phonetic": [
              "/ðə/",
              "/ˈwɪndəʊ/"
            ],
            "pos": "名词短语",
            "meaning": "窗户"
          }
        ],
        "explanations": [
          "**Do you mind...?** 是礼貌地询问对方是否介意。注意：回答时 **No** 表示「不介意（可以开）」，**Yes** 表示「介意（别开）」，和中文直觉相反！",
          "**if 从句用一般现在时表将来**。常见错误：\n• \"if I **opened**\" → if 从句不用过去时\n• \"if I **opening**\" → 缺少主语和谓语结构",
          "**the window** 特指当前这扇窗。如果泛指任何窗户可以说 \"a window\" 或 \"windows\"。"
        ]
      },
      {
        "sentence": "I'll give you a call when I get home.",
        "cid": "efb3c8ea",
        "translation": "我到家后给你打电话。",
        "chunks": [
          "I'll give you a call",
          "when I get home."
        ],
        "hints": [
          "我会给你打电话",
          "当我到家时"
        ],
        "grammar": [
          {
            "role": "主句",
            "color": "#e74c7a",
            "phonetic": [
              "/aɪl/",
              "/ɡɪv/",
              "/juː/",
              "/ə/",
              "/kɔːl/"
            ],
            "pos": "一般将来时",
            "meaning": "我会给你打电话"
          },
          {
            "role": "时间状语从句",
            "color": "#7c5cbf",
            "phonetic": [
              "/wen/",
              "/aɪ/",
              "/ɡet/",
              "/həʊm/"
            ],
            "pos": "时间状语从句",
            "meaning": "当我到家时"
          }
        ],
        "explanations": [
          "**'ll = will**，表示将来。常见错误：\n• \"I **give** you a call\" → 缺少将来时态标记\n• \"I **would** give\" → would 是虚拟语气，这里不需要",
          "**时间状语从句用一般现在时表将来**（主将从现原则）。常见错误：\n• \"when I **will** get\" → when/if 引导的从句不用 will\n• \"when I **got** home\" → 过去时与主句将来时矛盾\n• **home** 在这里是副词，前面不加 to（get home = 到家）"
        ]
      },
      {
        "sentence": "Thanks for helping me out yesterday.",
        "cid": "61b69c3a",
        "translation": "谢谢你昨天帮我解围。",
        "chunks": [
          "Thanks for",
          "helping me out",
          "yesterday."
        ],
        "hints": [
          "谢谢",
          "帮我解围",
          "昨天"
        ],
        "grammar": [
          {
            "role": "核心谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/θæŋks/",
              "/fɔːr/"
            ],
            "pos": "介词动词",
            "meaning": "谢谢"
          },
          {
            "role": "介词宾语",
            "color": "#3358e0",
            "phonetic": [
              "/ˈhelpɪŋ/",
              "/miː/",
              "/aʊt/"
            ],
            "pos": "动名词短语",
            "meaning": "帮我解围"
          },
          {
            "role": "时间状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/ˈjestədeɪ/"
            ],
            "pos": "副词",
            "meaning": "昨天"
          }
        ],
        "explanations": [
          "**Thank / Thanks + for + doing** 是固定搭配。常见错误：\n• \"Thank you **to** help\" → to 不对，要用 for\n• \"Thanks **you**\" → Thanks 已经包含「你」的意思，不需要再加 you",
          "**help sb out** = 帮某人摆脱困境/解围。out 在这里表示「从困境中出来」。如果只说 \"helping me\" 也可以，但少了「解围」这层含义。",
          "**yesterday** 是过去时间副词，放在句末或句首都可以。注意：yesterday 不能和现在完成时连用（不能说 \"I have seen him yesterday\"）。"
        ]
      },
      {
        "sentence": "Are you doing anything this evening?",
        "cid": "b3b8b56c",
        "translation": "你今晚有什么安排吗？",
        "chunks": [
          "Are you doing anything",
          "this evening?"
        ],
        "hints": [
          "你在做什么事情吗",
          "今晚"
        ],
        "grammar": [
          {
            "role": "主句谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/ɑːr/",
              "/juː/",
              "/ˈduːɪŋ/",
              "/ˈeniθɪŋ/"
            ],
            "pos": "现在进行时",
            "meaning": "你在做什么事吗"
          },
          {
            "role": "时间状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/ðɪs/",
              "/ˈiːvnɪŋ/"
            ],
            "pos": "名词短语",
            "meaning": "今晚"
          }
        ],
        "explanations": [
          "**Are you doing anything...?** 是问对方近期安排的标准开头。用现在进行时表将来计划。常见错误：\n• \"Do you doing anything\" → 疑问句 be 要提前\n• \"Are you **do** anything\" → 进行时需要 doing",
          "**this evening** 前不加介词（on this evening ❌）。想约人时可接：Are you doing anything this evening? — 我想约你看电影。"
        ]
      },
      {
        "sentence": "I'd love to, but I'm afraid I'm busy.",
        "cid": "c5333fc3",
        "translation": "我很想去，但恐怕我没空。",
        "chunks": [
          "I'd love to,",
          "but I'm afraid",
          "I'm busy."
        ],
        "hints": [
          "我很乐意",
          "但恐怕",
          "我很忙"
        ],
        "grammar": [
          {
            "role": "主句",
            "color": "#e74c7a",
            "phonetic": [
              "/aɪd/",
              "/lʌv/",
              "/tuː/"
            ],
            "pos": "would love to",
            "meaning": "我很乐意"
          },
          {
            "role": "转折从句",
            "color": "#7c5cbf",
            "phonetic": [
              "/bʌt/",
              "/aɪm/",
              "/əˈfreɪd/"
            ],
            "pos": "委婉表达",
            "meaning": "但恐怕"
          },
          {
            "role": "宾语从句",
            "color": "#3358e0",
            "phonetic": [
              "/aɪm/",
              "/ˈbɪzi/"
            ],
            "pos": "主系表",
            "meaning": "我很忙"
          }
        ],
        "explanations": [
          "**I'd love to, but...** 是拒绝邀请的礼貌句式（先肯定再转折）。常见错误：\n• \"I'd love **it**, but\" → 这里 to 代替整句（I'd love to go），不用 it\n• 直接说 No → 太生硬，不礼貌",
          "**I'm afraid** 在这里不是「害怕」，而是「恐怕/遗憾」，用来软化拒绝。口语高频：I'm afraid I can't make it."
        ]
      },
      {
        "sentence": "Why don't we meet at the usual place?",
        "cid": "e5c1bf50",
        "translation": "我们在老地方见怎么样？",
        "chunks": [
          "Why don't we meet",
          "at the usual place?"
        ],
        "hints": [
          "我们何不见面",
          "在老地方"
        ],
        "grammar": [
          {
            "role": "建议主句",
            "color": "#e74c7a",
            "phonetic": [
              "/waɪ/",
              "/doʊnt/",
              "/wiː/",
              "/miːt/"
            ],
            "pos": "建议疑问句",
            "meaning": "我们何不见面"
          },
          {
            "role": "地点状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/æt/",
              "/ðə/",
              "/ˈjuːʒuəl/",
              "/pleɪs/"
            ],
            "pos": "介词短语",
            "meaning": "在老地方"
          }
        ],
        "explanations": [
          "**Why don't we...?** = 我们……怎么样？是提建议的常用句式。常见错误：\n• \"Why we don't meet\" → 疑问句 don't 提前\n• \"Why don't we **to** meet\" → 后接动词原形",
          "**the usual place** = 老地方（双方都熟悉的地方）。usual 是形容词「惯常的」。"
        ]
      },
      {
        "sentence": "I'll pick you up at your place.",
        "cid": "9ae0b549",
        "translation": "我去你那儿接你。",
        "chunks": [
          "I'll pick you up",
          "at your place."
        ],
        "hints": [
          "我会接你",
          "在你家"
        ],
        "grammar": [
          {
            "role": "主句谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/aɪl/",
              "/pɪk/",
              "/juː/",
              "/ʌp/"
            ],
            "pos": "一般将来时",
            "meaning": "我会接你"
          },
          {
            "role": "地点状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/æt/",
              "/jɔːr/",
              "/pleɪs/"
            ],
            "pos": "介词短语",
            "meaning": "在你家"
          }
        ],
        "explanations": [
          "**pick sb up** = 开车接某人。代词放中间：pick **you** up / pick **me** up。常见错误：\n• \"pick up **you**\" → 代词必须放中间\n• \"pick you **upstairs**\" → upstairs 是楼上，不是接你",
          "**your place** = 你家（口语）。比较：at my place / at home。正式说法 your house / your apartment。"
        ]
      },
      {
        "sentence": "Could we reschedule for tomorrow instead?",
        "cid": "249e8feb",
        "translation": "我们能改到明天吗？",
        "chunks": [
          "Could we reschedule",
          "for tomorrow instead?"
        ],
        "hints": [
          "我们能改期吗",
          "改到明天"
        ],
        "grammar": [
          {
            "role": "情态主谓",
            "color": "#e74c7a",
            "phonetic": [
              "/kʊd/",
              "/wiː/",
              "/riːˈʃedjuːl/"
            ],
            "pos": "情态动词+动词",
            "meaning": "我们能改期吗"
          },
          {
            "role": "时间状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/fɔːr/",
              "/təˈmɒroʊ/",
              "/ɪnˈsted/"
            ],
            "pos": "介词短语",
            "meaning": "改到明天"
          }
        ],
        "explanations": [
          "**reschedule** = 重新安排时间（re + schedule）。常见错误：\n• \"change the schedule\" → 也可以，但 reschedule 更地道\n• \"reschedule **to** tomorrow\" → 固定搭配是 for tomorrow",
          "**instead** = 作为替代，放句末。完整意思：不是原定时间，而是改为明天。"
        ]
      },
      {
        "sentence": "I'm running a bit late, sorry.",
        "cid": "684f3d80",
        "translation": "我可能要晚点到，抱歉。",
        "chunks": [
          "I'm running",
          "a bit late,",
          "sorry."
        ],
        "hints": [
          "我（变得）",
          "稍微晚了",
          "抱歉"
        ],
        "grammar": [
          {
            "role": "主句谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/aɪm/",
              "/ˈrʌnɪŋ/"
            ],
            "pos": "现在进行时",
            "meaning": "我在（变）"
          },
          {
            "role": "程度+表语",
            "color": "#3358e0",
            "phonetic": [
              "/ə/",
              "/bɪt/",
              "/leɪt/"
            ],
            "pos": "副词短语",
            "meaning": "稍微晚"
          },
          {
            "role": "致歉插入语",
            "color": "#7c5cbf",
            "phonetic": [
              "/ˈsɒri/"
            ],
            "pos": "感叹词",
            "meaning": "抱歉"
          }
        ],
        "explanations": [
          "**run late** = 迟到/时间赶不上（run 表「变得」，口语固定搭配）。常见错误：\n• \"I'm **arriving** late\" → 可以但 run late 更口语\n• \"I'm late **running**\" → 语序反了",
          "迟到通知要主动：I'm running a bit late. / I'll be there in ten minutes.（十分钟到）"
        ]
      },
      {
        "sentence": "How do you usually get to work?",
        "cid": "f26b491f",
        "translation": "你平时怎么去上班？",
        "chunks": [
          "How do you usually",
          "get to work?"
        ],
        "hints": [
          "你怎么通常",
          "去上班"
        ],
        "grammar": [
          {
            "role": "疑问主句",
            "color": "#c87033",
            "phonetic": [
              "/haʊ/",
              "/duː/",
              "/juː/",
              "/ˈjuːʒuəli/"
            ],
            "pos": "特殊疑问句",
            "meaning": "你怎么通常"
          },
          {
            "role": "谓语+宾语",
            "color": "#e74c7a",
            "phonetic": [
              "/ɡet/",
              "/tuː/",
              "/wɜːrk/"
            ],
            "pos": "动词短语",
            "meaning": "去上班"
          }
        ],
        "explanations": [
          "**get to work** = 到达工作地点。常见错误：\n• \"go to work\" → 也可以（go 侧重去的过程），get 侧重到达\n• \"get **in** work\" → in 用于 get in the car，地点用 get to",
          "回答交通方式：by bus / by subway / on foot / take the subway。通常用于了解对方的通勤习惯。"
        ]
      },
      {
        "sentence": "Do you prefer coffee or tea?",
        "cid": "5b28a18d",
        "translation": "你更喜欢咖啡还是茶？",
        "chunks": [
          "Do you prefer",
          "coffee or tea?"
        ],
        "hints": [
          "你更喜欢",
          "咖啡还是茶"
        ],
        "grammar": [
          {
            "role": "主句谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/duː/",
              "/juː/",
              "/prɪˈfɜːr/"
            ],
            "pos": "一般疑问句",
            "meaning": "你更喜欢"
          },
          {
            "role": "宾语",
            "color": "#3358e0",
            "phonetic": [
              "/ˈkɒfi/",
              "/ɔːr/",
              "/tiː/"
            ],
            "pos": "选择疑问句",
            "meaning": "咖啡还是茶"
          }
        ],
        "explanations": [
          "**prefer A or B?** 是选择题问法。常见错误：\n• \"Do you **more** like coffee\" → 比较要用 prefer，不是 more like\n• \"Do you prefer **to** coffee\" → prefer 直接接名词，不加 to",
          "**prefer** 常见搭配：prefer A to B（比起 B 更喜欢 A）、prefer doing。注意这里 A or B 问句结构。"
        ]
      },
      {
        "sentence": "What's your favorite way to relax?",
        "cid": "300d8e13",
        "translation": "你最喜欢的放松方式是什么？",
        "chunks": [
          "What's your favorite way",
          "to relax?"
        ],
        "hints": [
          "你最喜欢的方式",
          "去放松"
        ],
        "grammar": [
          {
            "role": "主句",
            "color": "#c87033",
            "phonetic": [
              "/wɒts/",
              "/jɔːr/",
              "/ˈfeɪvərɪt/",
              "/weɪ/"
            ],
            "pos": "主系表",
            "meaning": "你最喜欢的方式"
          },
          {
            "role": "后置定语",
            "color": "#3358e0",
            "phonetic": [
              "/tuː/",
              "/rɪˈlæks/"
            ],
            "pos": "不定式短语",
            "meaning": "用来放松"
          }
        ],
        "explanations": [
          "**What's your favorite way to...?** = 你最喜欢用什么方式做……？常见错误：\n• \"What **is your favorite way for** relax\" → 固定搭配 way to do\n• \"How's your favorite way\" → how 问方式，这里问的是「什么」",
          "回答：I like to watch movies / go for a walk / listen to music. 类似问法：What do you do to relax?"
        ]
      },
      {
        "sentence": "I've been working on it all day.",
        "cid": "fdc5ae18",
        "translation": "我一整天都在忙这件事。",
        "chunks": [
          "I've been working",
          "on it",
          "all day."
        ],
        "hints": [
          "我一直在忙",
          "这件事",
          "一整天"
        ],
        "grammar": [
          {
            "role": "主句谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/aɪv/",
              "/bɪn/",
              "/ˈwɜːrkɪŋ/"
            ],
            "pos": "现在完成进行时",
            "meaning": "我一直在忙"
          },
          {
            "role": "介词短语",
            "color": "#7c5cbf",
            "phonetic": [
              "/ɒn/",
              "/ɪt/"
            ],
            "pos": "work on 搭配",
            "meaning": "这件事"
          },
          {
            "role": "时间状语",
            "color": "#3358e0",
            "phonetic": [
              "/ɔːl/",
              "/deɪ/"
            ],
            "pos": "名词短语",
            "meaning": "一整天"
          }
        ],
        "explanations": [
          "**have been doing** = 现在完成进行时，强调动作从过去一直持续到现在。常见错误：\n• \"I **work** on it all day\" → 缺少进行/完成含义\n• \"I've been working **in** it\" → 搭配是 work on sth",
          "**all day** = 整天（all + 时间名词）。类似：all night / all week / all morning。"
        ]
      },
      {
        "sentence": "It was really nice talking to you.",
        "cid": "3edf0897",
        "translation": "和你聊天真的很愉快。",
        "chunks": [
          "It was really nice",
          "talking to you."
        ],
        "hints": [
          "真的很愉快",
          "和你聊天"
        ],
        "grammar": [
          {
            "role": "主句",
            "color": "#c87033",
            "phonetic": [
              "/ɪt/",
              "/wɒz/",
              "/ˈrɪəli/",
              "/naɪs/"
            ],
            "pos": "主系表",
            "meaning": "真的很愉快"
          },
          {
            "role": "真正主语",
            "color": "#e74c7a",
            "phonetic": [
              "/ˈtɔːkɪŋ/",
              "/tuː/",
              "/juː/"
            ],
            "pos": "动名词短语",
            "meaning": "和你聊天"
          }
        ],
        "explanations": [
          "**It was nice talking to you.** 是道别时的客气话。句型：It is/was + adj + doing（真正主语后置）。常见错误：\n• \"It was nice **to talking**\" → 只能二选一：to talk 或 talking\n• \"Nice talking **with** you\" → 可以，但 to 更常见",
          "见面时说 Nice to meet you；分别时说 It was nice talking to you. 更合适。"
        ]
      },
      {
        "sentence": "Sorry, I have to go now.",
        "cid": "f2d8d822",
        "translation": "抱歉，我得走了。",
        "chunks": [
          "Sorry,",
          "I have to go",
          "now."
        ],
        "hints": [
          "抱歉",
          "我得走了",
          "现在"
        ],
        "grammar": [
          {
            "role": "致歉插入语",
            "color": "#7c5cbf",
            "phonetic": [
              "/ˈsɒri/"
            ],
            "pos": "感叹词",
            "meaning": "抱歉"
          },
          {
            "role": "主句谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/aɪ/",
              "/hæv/",
              "/tuː/",
              "/ɡəʊ/"
            ],
            "pos": "have to 结构",
            "meaning": "我得走"
          },
          {
            "role": "时间状语",
            "color": "#3358e0",
            "phonetic": [
              "/naʊ/"
            ],
            "pos": "副词",
            "meaning": "现在"
          }
        ],
        "explanations": [
          "**have to** = 不得不（客观原因）。与 **must** 区别：must 侧重主观义务，have to 侧重客观需要。常见错误：\n• \"I have **go**\" → have to 后接动词原形\n• \"I must to go\" → must 后直接接原形，不加 to",
          "道别常用三步：Sorry, I have to go now. → It was nice talking to you. → See you later!"
        ]
      },
      {
        "sentence": "What do you think of this idea?",
        "cid": "a5117784",
        "translation": "你觉得这个主意怎么样？",
        "chunks": [
          "What do you think",
          "of this idea?"
        ],
        "hints": [
          "你怎么看",
          "这个主意"
        ],
        "grammar": [
          {
            "role": "疑问主句",
            "color": "#e74c7a",
            "phonetic": [
              "/wɒt/",
              "/duː/",
              "/juː/",
              "/θɪŋk/"
            ],
            "pos": "特殊疑问句",
            "meaning": "你怎么看"
          },
          {
            "role": "介词短语",
            "color": "#7c5cbf",
            "phonetic": [
              "/əv/",
              "/ðɪs/",
              "/aɪˈdɪə/"
            ],
            "pos": "介词短语",
            "meaning": "这个主意"
          }
        ],
        "explanations": [
          "**What do you think of...?** = 你对……怎么看？常见错误：\n• \"How do you think **about** it\" → 也有人说，但标准句式是 What ... think of\n• \"What are you think\" → 疑问句用助动词 do，不是 be",
          "征求意见的两大句式：What do you think of...? / How do you like...? 回答：I think it's great / I'm not sure about it."
        ]
      },
      {
        "sentence": "Could you give me a moment, please?",
        "cid": "b95cd0f4",
        "translation": "请稍等一下好吗？",
        "chunks": [
          "Could you give me",
          "a moment,",
          "please?"
        ],
        "hints": [
          "你能给我",
          "一点时间",
          "麻烦"
        ],
        "grammar": [
          {
            "role": "情态+双宾",
            "color": "#e74c7a",
            "phonetic": [
              "/kʊd/",
              "/juː/",
              "/ɡɪv/",
              "/miː/"
            ],
            "pos": "情态动词+双宾语",
            "meaning": "你能给我"
          },
          {
            "role": "宾语",
            "color": "#3358e0",
            "phonetic": [
              "/ə/",
              "/ˈmoʊmənt/"
            ],
            "pos": "名词短语",
            "meaning": "一点时间"
          },
          {
            "role": "礼貌词",
            "color": "#7c5cbf",
            "phonetic": [
              "/pliːz/"
            ],
            "pos": "语气词",
            "meaning": "麻烦"
          }
        ],
        "explanations": [
          "**give sb a moment** = 给某人一点时间。常见错误：\n• \"give a moment **to me**\" → 双宾 give me a moment 更自然\n• \"wait me a moment\" → wait 是不及物动词，不能直接接宾语",
          "同义表达：Just a moment, please. / One second, please. / Hang on a second.（更口语）"
        ]
      },
      {
        "sentence": "I didn't get much sleep last night.",
        "cid": "73225f28",
        "translation": "我昨晚没睡多少觉。",
        "chunks": [
          "I didn't get",
          "much sleep",
          "last night."
        ],
        "hints": [
          "我没得到",
          "多少睡眠",
          "昨晚"
        ],
        "grammar": [
          {
            "role": "主句谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/aɪ/",
              "/ˈdɪdnt/",
              "/ɡet/"
            ],
            "pos": "一般过去时否定",
            "meaning": "我没得到"
          },
          {
            "role": "宾语",
            "color": "#3358e0",
            "phonetic": [
              "/mʌtʃ/",
              "/sliːp/"
            ],
            "pos": "不可数名词",
            "meaning": "多少睡眠"
          },
          {
            "role": "时间状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/lɑːst/",
              "/naɪt/"
            ],
            "pos": "名词短语",
            "meaning": "昨晚"
          }
        ],
        "explanations": [
          "**get sleep** = 睡（觉），get 后接不可数名词 sleep。常见错误：\n• \"didn't **slept**\" → did 后接原形 sleep/slept 是过去式\n• \"much **sleeps**\" → sleep 不可数，不加 s",
          "**last night** = 昨晚。不能说 yesterday night（错误），要说 last night 或 yesterday evening。"
        ]
      },
      {
        "sentence": "Let me know if you need anything.",
        "cid": "9f813037",
        "translation": "你需要什么就告诉我。",
        "chunks": [
          "Let me know",
          "if you need anything."
        ],
        "hints": [
          "让我知道",
          "如果你需要什么"
        ],
        "grammar": [
          {
            "role": "祈使主句",
            "color": "#e74c7a",
            "phonetic": [
              "/let/",
              "/miː/",
              "/noʊ/"
            ],
            "pos": "let sb do 结构",
            "meaning": "让我知道"
          },
          {
            "role": "条件从句",
            "color": "#7c5cbf",
            "phonetic": [
              "/ɪf/",
              "/juː/",
              "/niːd/",
              "/ˈeniθɪŋ/"
            ],
            "pos": "条件状语从句",
            "meaning": "如果你需要什么"
          }
        ],
        "explanations": [
          "**Let me know if...** = 如果……就告诉我。let 后接动词原形（let sb do）。常见错误：\n• \"Let me **to** know\" → let 后不加 to\n• \"Let me **knowing**\" → 用原形 know",
          "主动提供帮助的客套话，主人对客人、同事间都很常用。同义：If you need anything, just ask."
        ]
      },
      {
        "sentence": "That reminds me of something.",
        "cid": "5e6bba59",
        "translation": "那让我想起了一件事。",
        "chunks": [
          "That reminds me",
          "of something."
        ],
        "hints": [
          "那提醒我",
          "关于某事"
        ],
        "grammar": [
          {
            "role": "主句谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/ðæt/",
              "/rɪˈmaɪndz/",
              "/miː/"
            ],
            "pos": "一般现在时",
            "meaning": "那提醒我"
          },
          {
            "role": "介词短语",
            "color": "#7c5cbf",
            "phonetic": [
              "/əv/",
              "/ˈsʌmθɪŋ/"
            ],
            "pos": "remind of 搭配",
            "meaning": "关于某事"
          }
        ],
        "explanations": [
          "**remind sb of sth** = 让某人想起某事。常见错误：\n• \"remind me **about** something\" → about 是「提醒」，of 是「使想起」，语境不同\n• \"That **remember** me\" → 人作主语才用 remember，事物用 remind",
          "口语中常用来引出话题：That reminds me of a funny story...（那让我想起一个有趣的故事）。"
        ]
      },
      {
        "sentence": "Shall we take a walk after dinner?",
        "cid": "5f612d59",
        "translation": "晚饭后我们去散散步好吗？",
        "chunks": [
          "Shall we",
          "take a walk",
          "after dinner?"
        ],
        "hints": [
          "我们要不要",
          "散散步",
          "晚饭后"
        ],
        "grammar": [
          {
            "role": "建议句式",
            "color": "#e74c7a",
            "phonetic": [
              "/ʃæl/",
              "/wiː/"
            ],
            "pos": "Shall we 建议",
            "meaning": "我们要不要"
          },
          {
            "role": "谓语+宾语",
            "color": "#3358e0",
            "phonetic": [
              "/teɪk/",
              "/ə/",
              "/wɔːk/"
            ],
            "pos": "动词短语",
            "meaning": "散散步"
          },
          {
            "role": "时间状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/ˈɑːftər/",
              "/ˈdɪnər/"
            ],
            "pos": "介词短语",
            "meaning": "晚饭后"
          }
        ],
        "explanations": [
          "**Shall we...?** = 我们……好吗？（英式常用，表提议）。常见错误：\n• \"Will we take a walk\" → Shall we 才是标准提议句式\n• \"Shall we **to** take\" → shall 后接动词原形",
          "**take a walk** = 散步，固定搭配。同义：go for a walk / go for a stroll。美式更多说 Let's go for a walk."
        ]
      },
      {
        "sentence": "What time do you get off work?",
        "cid": "5cac61f5",
        "translation": "你几点下班？",
        "chunks": [
          "What time",
          "do you get off work?"
        ],
        "hints": [
          "几点",
          "你下班"
        ],
        "grammar": [
          {
            "role": "疑问词",
            "color": "#e74c7a",
            "phonetic": [
              "/wɒt/",
              "/taɪm/"
            ],
            "pos": "特殊疑问词",
            "meaning": "几点"
          },
          {
            "role": "谓语",
            "color": "#c87033",
            "phonetic": [
              "/duː/",
              "/juː/",
              "/ɡet/",
              "/ɒf/",
              "/wɜːrk/"
            ],
            "pos": "get off 搭配",
            "meaning": "你下班"
          }
        ],
        "explanations": [
          "**get off work** = 下班（get off 表示「结束工作」）。常见错误：\n• \"get out of work\" → 不是下班，是「逃避工作/被解雇（口）」\n• \"leave the work\" → leave work 可以，但 get off work 更口语",
          "相关表达：go to work 上班 / knock off (work) 收工（口语）/ be off duty 下班（值班人员）。"
        ]
      },
      {
        "sentence": "I'll see you at the entrance at seven.",
        "cid": "f900c537",
        "translation": "我们七点在入口见。",
        "chunks": [
          "I'll see you",
          "at the entrance",
          "at seven."
        ],
        "hints": [
          "我会见到你",
          "在入口",
          "七点"
        ],
        "grammar": [
          {
            "role": "主句",
            "color": "#e74c7a",
            "phonetic": [
              "/aɪl/",
              "/siː/",
              "/juː/"
            ],
            "pos": "一般将来时",
            "meaning": "我会见到你"
          },
          {
            "role": "地点状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/æt/",
              "/ði/",
              "/ˈentrəns/"
            ],
            "pos": "介词短语",
            "meaning": "在入口"
          },
          {
            "role": "时间状语",
            "color": "#3358e0",
            "phonetic": [
              "/æt/",
              "/ˈsevn/"
            ],
            "pos": "at+时刻",
            "meaning": "七点"
          }
        ],
        "explanations": [
          "**see you at + 地点 + at + 时间**：地点用 at，时刻用 at。常见错误：\n• \"see you **on** the entrance\" → 地点在门口用 at 不用 on\n• \"at seven o'clock **pm**\" → 口语说 at seven 即可",
          "约定见面：地点 + 时间两个要素都要交代清楚。I'll see you there!（到那儿见！）"
        ]
      },
      {
        "sentence": "Can I try this on?",
        "cid": "8e88da8b",
        "translation": "我可以试穿这件吗？",
        "chunks": [
          "Can I",
          "try this on?"
        ],
        "hints": [
          "我可以吗",
          "试穿这件"
        ],
        "grammar": [
          {
            "role": "情态主语",
            "color": "#c87033",
            "phonetic": [
              "/kæn/",
              "/aɪ/"
            ],
            "pos": "情态动词+主语",
            "meaning": "我可以"
          },
          {
            "role": "谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/traɪ/",
              "/ðɪs/",
              "/ɒn/"
            ],
            "pos": "动词短语",
            "meaning": "试穿这件"
          }
        ],
        "explanations": [
          "**Can I...?** 请求许可。Could/May 更礼貌，Can 最常用。注意：回答 \"You can\" 或 \"Sure\" 表示允许。",
          "**try sth on** 是固定短语（= 试穿）。关键规则：**代词必须放在中间**！\n• \"try **on** this\" → ❌ 代词不能放后面\n• \"try **it/them** on\" → ✅ 正确（it=单件，them=多件）"
        ]
      },
      {
        "sentence": "Do you have this in a smaller size?",
        "cid": "11eab175",
        "translation": "这个有小一号的吗？",
        "chunks": [
          "Do you have this",
          "in a smaller size?"
        ],
        "hints": [
          "你们有这个吗",
          "小一号尺码的"
        ],
        "grammar": [
          {
            "role": "主句谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/duː/",
              "/juː/",
              "/hæv/",
              "/ðɪs/"
            ],
            "pos": "一般疑问句",
            "meaning": "你们有这个吗"
          },
          {
            "role": "方式状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/ɪn/",
              "/ə/",
              "/ˈsmɔːlər/",
              "/saɪz/"
            ],
            "pos": "介词短语",
            "meaning": "小一号尺码"
          }
        ],
        "explanations": [
          "**have** 是实义动词，疑问句需要助动词 **Do**。常见错误：\n• \"**Have** you this...\" → ❌ have 作实义动词不能直接提问\n• \"Do you **got** this...\" → ❌ got 是过去分词，不能用在这里",
          "**in + size/color** 是询问款式规格的固定搭配。常见错误：\n• \"**with** a smaller size\" → with 不对\n• \"**of** a smaller size\" → of 也可以但 in 更常用"
        ]
      },
      {
        "sentence": "How much does this cost?",
        "cid": "a502b123",
        "translation": "这个多少钱？",
        "chunks": [
          "How much",
          "does this cost?"
        ],
        "hints": [
          "多少",
          "这个卖"
        ],
        "grammar": [
          {
            "role": "疑问词组",
            "color": "#7c5cbf",
            "phonetic": [
              "/haʊ/",
              "/mʌtʃ/"
            ],
            "pos": "疑问词+副词",
            "meaning": "多少钱"
          },
          {
            "role": "谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/dʌz/",
              "/ðɪs/",
              "/kɒst/"
            ],
            "pos": "一般现在时疑问",
            "meaning": "这个卖（多少钱）"
          }
        ],
        "explanations": [
          "**How much** 问价格（不可数）。问可数数量用 **How many**。cost 是抽象概念，所以用 much。",
          "**does + 主语 + 动词原形**。常见错误：\n• \"How much **is** this cost?\" → ❌ cost 是动词，不能和 be 动词连用\n• \"How much **this** costs?\" → 这是陈述语序，不是疑问句\n• 注意：**cost** 的过去式还是 cost（不规则变化）"
        ]
      },
      {
        "sentence": "I'm just looking around, thanks.",
        "cid": "ea8bea79",
        "translation": "我只是随便看看，谢谢。",
        "chunks": [
          "I'm just",
          "looking around,",
          "thanks."
        ],
        "hints": [
          "我只是",
          "随便看看",
          "谢谢"
        ],
        "grammar": [
          {
            "role": "主语+状语",
            "color": "#c87033",
            "phonetic": [
              "/aɪm/",
              "/dʒʌst/"
            ],
            "pos": "主系结构",
            "meaning": "我只是"
          },
          {
            "role": "现在分词",
            "color": "#e74c7a",
            "phonetic": [
              "/ˈlʊkɪŋ/",
              "/əˈraʊnd/"
            ],
            "pos": "进行时态",
            "meaning": "随便看看"
          },
          {
            "role": "插入语",
            "color": "#7c5cbf",
            "phonetic": [
              "/θæŋks/"
            ],
            "pos": "感叹词",
            "meaning": "谢谢"
          }
        ],
        "explanations": [
          "**just** 在这里表示「只是、仅仅」，语气委婉（= 我不买，就是看看）。常见错误：\n• \"I **only** looking\" → only 是形容词/副词，不能代替 just 的语法功能\n• \"I **am** just **look**\" → 缺少 ing（表示正在进行的动作）",
          "**look around** = 四处看看。around 表示方向上的「到处」。常见错误：\n• 只说 \"**looking**\" → 也可以，但少了「四处」这层随意感\n• \"look **round**\" → 英式英语也可以，美式用 around",
          "**thanks** 比 thank you 更口语化，在购物场景中非常自然，表示委婉拒绝店员的推销。"
        ]
      },
      {
        "sentence": "Is this item on sale?",
        "cid": "4a8ecc17",
        "translation": "这件商品在打折吗？",
        "chunks": [
          "Is this item",
          "on sale?"
        ],
        "hints": [
          "这件商品是吗",
          "在打折"
        ],
        "grammar": [
          {
            "role": "主语",
            "color": "#c87033",
            "phonetic": [
              "/ɪz/",
              "/ðɪs/",
              "/ˈaɪtəm/"
            ],
            "pos": "名词短语",
            "meaning": "这件商品"
          },
          {
            "role": "表语",
            "color": "#3358e0",
            "phonetic": [
              "/ɒn/",
              "/seɪl/"
            ],
            "pos": "介词短语",
            "meaning": "在打折"
          }
        ],
        "explanations": [
          "**this item** 中 item = 商品、单品。也可以省略直接说 \"Is **this** on sale?\"",
          "**on sale** = 打折中 / 特价。注意和 **for sale** 的区别：\n• **on sale** = 降价出售（原价 100 → 现价 70）\n• **for sale** = 待售（不管打没打折，就是「在卖」）\n常见错误：用 \"**in** sale\" → ❌ 不对"
        ]
      },
      {
        "sentence": "Could I pay by credit card?",
        "cid": "5bd1ca12",
        "translation": "我可以用信用卡付款吗？",
        "chunks": [
          "Could I pay",
          "by credit card?"
        ],
        "hints": [
          "我可以付款吗",
          "用信用卡"
        ],
        "grammar": [
          {
            "role": "情态主谓",
            "color": "#e74c7a",
            "phonetic": [
              "/kʊd/",
              "/aɪ/",
              "/peɪ/"
            ],
            "pos": "情态动词+动词",
            "meaning": "我可以付款"
          },
          {
            "role": "方式状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/baɪ/",
              "/ˈkredɪt/",
              "/kɑːrd/"
            ],
            "pos": "介词短语",
            "meaning": "用信用卡"
          }
        ],
        "explanations": [
          "**Could I...?** 比 Can I 更礼貌委婉。在购物、服务场景中很常用。",
          "**by + 支付方式** 是固定搭配。常见错误：\n• \"**with** credit card\" → with 不对，要用 **by**\n• \"**use** credit card\" → 语法没错但不够地道\n• **credit card** 前面通常不加 a/the（作为固定说法）"
        ]
      },
      {
        "sentence": "I'd like to return this item, please.",
        "cid": "49fecae0",
        "translation": "我想退掉这件商品。",
        "chunks": [
          "I'd like to",
          "return this item,",
          "please."
        ],
        "hints": [
          "我想要",
          "退这件商品",
          "麻烦了"
        ],
        "grammar": [
          {
            "role": "主谓",
            "color": "#c87033",
            "phonetic": [
              "/aɪd/",
              "/laɪk/",
              "/tuː/"
            ],
            "pos": "would like 结构",
            "meaning": "我想要"
          },
          {
            "role": "不定式谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/rɪˈtɜːrn/",
              "/ðɪs/",
              "/ˈaɪtəm/"
            ],
            "pos": "不定式短语",
            "meaning": "退这件商品"
          },
          {
            "role": "语气词",
            "color": "#7c5cbf",
            "phonetic": [
              "/pliːz/"
            ],
            "pos": "礼貌用语",
            "meaning": "麻烦了"
          }
        ],
        "explanations": [
          "**'d like = would like**，比 want 更委婉客气。常见错误：\n• \"I **want** to return\" → 语法正确但不够礼貌\n• \"I **would like** return\" → ❌ like 后面要加 to",
          "**return** = 退货。常见错误：\n• \"**give back** this item\" → 口语也可以，但 return 更正式\n• \"**exchange**\" = 换货（不是退货），不要混淆",
          "**please** 放在句末表示礼貌请求，用逗号隔开。"
        ]
      },
      {
        "sentence": "Do you offer a refund without a receipt?",
        "cid": "27e9bd68",
        "translation": "没有小票可以退款吗？",
        "chunks": [
          "Do you offer a refund",
          "without a receipt?"
        ],
        "hints": [
          "你们提供退款吗",
          "在没有小票的情况下"
        ],
        "grammar": [
          {
            "role": "主句谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/duː/",
              "/juː/",
              "/ˈɒfər/",
              "/ə/",
              "/rɪˈfʌnd/"
            ],
            "pos": "一般疑问句",
            "meaning": "你们提供退款吗"
          },
          {
            "role": "条件状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/wɪˈðaʊt/",
              "/ə/",
              "/rɪˈsiːt/"
            ],
            "pos": "介词短语",
            "meaning": "没有小票的情况下"
          }
        ],
        "explanations": [
          "**offer** = 提供（服务）。常见错误：\n• \"Do you **refund**...\" → refund 是动词「退款」，但这里强调的是「是否提供这项服务」\n• \"Can I **get** a refund\" → 也可以，但 offer 更侧重商家的服务政策",
          "**without a receipt** 中 **a 不能省略**。receipt 是可数名词。常见错误：\n• \"without **receipt**\" → ❌ 可数名词单数不能裸用\n• \"**no** receipt\" → 语法上也可以（no + 名词），但 without a 更常用"
        ]
      },
      {
        "sentence": "Where can I find the fitting room?",
        "cid": "09ee0d9c",
        "translation": "请问试衣间在哪里？",
        "chunks": [
          "Where can I find",
          "the fitting room?"
        ],
        "hints": [
          "我在哪能找到",
          "试衣间"
        ],
        "grammar": [
          {
            "role": "疑问主句",
            "color": "#e74c7a",
            "phonetic": [
              "/wer/",
              "/kæn/",
              "/aɪ/",
              "/faɪnd/"
            ],
            "pos": "特殊疑问句",
            "meaning": "我在哪能找到"
          },
          {
            "role": "宾语",
            "color": "#3358e0",
            "phonetic": [
              "/ðə/",
              "/ˈfɪtɪŋ/",
              "/ruːm/"
            ],
            "pos": "名词短语",
            "meaning": "试衣间"
          }
        ],
        "explanations": [
          "**Where can I find...?** 问某物/某地在哪，比 Where is... 更礼貌自然。常见错误：\n• \"Where I can find\" → 情态动词 can 提前\n• \"Where is the **fit** room\" → 固定说法 fitting room",
          "英式也说 the changing room。试衣间门上常见标识：Fitting Room / Dressing Room。"
        ]
      },
      {
        "sentence": "This shirt is a bit too big for me.",
        "cid": "8437bd38",
        "translation": "这件衬衫对我来说有点太大了。",
        "chunks": [
          "This shirt is",
          "a bit too big",
          "for me."
        ],
        "hints": [
          "这件衬衫是",
          "有点太大",
          "对我来说"
        ],
        "grammar": [
          {
            "role": "主语+be",
            "color": "#c87033",
            "phonetic": [
              "/ðɪs/",
              "/ʃɜːrt/",
              "/ɪz/"
            ],
            "pos": "主系结构",
            "meaning": "这件衬衫是"
          },
          {
            "role": "表语",
            "color": "#e74c7a",
            "phonetic": [
              "/ə/",
              "/bɪt/",
              "/tuː/",
              "/bɪɡ/"
            ],
            "pos": "程度+形容词",
            "meaning": "有点太大"
          },
          {
            "role": "对象状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/fɔːr/",
              "/miː/"
            ],
            "pos": "介词短语",
            "meaning": "对我来说"
          }
        ],
        "explanations": [
          "**too + 形容词 + for sb** = 对某人来说太……。常见错误：\n• \"too much big\" → big 是形容词，用 too（too much 修饰不可数名词/动词）\n• \"very too big\" → very 不能修饰 too",
          "**a bit too** = 稍微太……，比 too 语气缓和。试衣反馈常用：a bit too big / a little tight / just right（刚好）。"
        ]
      },
      {
        "sentence": "Do you have this in other colors?",
        "cid": "b6b38927",
        "translation": "这个有其他颜色吗？",
        "chunks": [
          "Do you have this",
          "in other colors?"
        ],
        "hints": [
          "你们有这个吗",
          "其他颜色"
        ],
        "grammar": [
          {
            "role": "主句谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/duː/",
              "/juː/",
              "/hæv/",
              "/ðɪs/"
            ],
            "pos": "一般疑问句",
            "meaning": "你们有这个吗"
          },
          {
            "role": "方式状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/ɪn/",
              "/ˈʌðər/",
              "/ˈkʌlərz/"
            ],
            "pos": "介词短语",
            "meaning": "其他颜色"
          }
        ],
        "explanations": [
          "**in other colors** = 以其他颜色（出售），in + 颜色/款式表示规格。常见错误：\n• \"with other colors\" → 用 in 不用 with\n• \"other **color**\" → 多种可选色用复数 colors",
          "换规格三连问：in other colors / in a smaller size / in a larger size。同类：in stock（有货）。"
        ]
      },
      {
        "sentence": "Can you recommend something cheaper?",
        "cid": "52e57cb1",
        "translation": "能推荐便宜点的吗？",
        "chunks": [
          "Can you recommend",
          "something cheaper?"
        ],
        "hints": [
          "你能推荐",
          "更便宜的东西"
        ],
        "grammar": [
          {
            "role": "情态主谓",
            "color": "#e74c7a",
            "phonetic": [
              "/kæn/",
              "/juː/",
              "/ˌrekəˈmend/"
            ],
            "pos": "请求句型",
            "meaning": "你能推荐"
          },
          {
            "role": "宾语",
            "color": "#3358e0",
            "phonetic": [
              "/ˈsʌmθɪŋ/",
              "/ˈtʃiːpər/"
            ],
            "pos": "复合不定代词",
            "meaning": "更便宜的东西"
          }
        ],
        "explanations": [
          "**something cheaper**：形容词修饰复合不定代词要**后置**。常见错误：\n• \"cheaper **something**\" → 形容词放 something/anything/nothing 后面\n• \"some **things** cheaper\" → 口语指某件东西用 something",
          "**recommend** = 推荐。同义：suggest。表达预算可说 I'm on a budget / I don't want to spend too much."
        ]
      },
      {
        "sentence": "I'm afraid it's out of stock.",
        "cid": "b4d9f9ed",
        "translation": "恐怕这款缺货了。",
        "chunks": [
          "I'm afraid",
          "it's out of stock."
        ],
        "hints": [
          "恐怕",
          "它缺货了"
        ],
        "grammar": [
          {
            "role": "引子",
            "color": "#7c5cbf",
            "phonetic": [
              "/aɪm/",
              "/əˈfreɪd/"
            ],
            "pos": "委婉开场",
            "meaning": "恐怕"
          },
          {
            "role": "宾语从句",
            "color": "#3358e0",
            "phonetic": [
              "/ɪts/",
              "/aʊt/",
              "/əv/",
              "/stɒk/"
            ],
            "pos": "固定短语",
            "meaning": "缺货了"
          }
        ],
        "explanations": [
          "**out of stock** = 缺货/售罄。常见错误：\n• \"out of **the** stock\" → 固定搭配不加 the\n• \"**no** stock\" → 口语可以说，但 out of stock 是标准说法",
          "反义：**in stock**（有货）。店员可说：We're out of stock right now. / Would you like me to check another store?（要不要我查下别的店？）"
        ]
      },
      {
        "sentence": "Could you wrap it up for me?",
        "cid": "317bf159",
        "translation": "能帮我把它包起来吗？",
        "chunks": [
          "Could you wrap it up",
          "for me?"
        ],
        "hints": [
          "你能包起来",
          "帮我"
        ],
        "grammar": [
          {
            "role": "情态主谓",
            "color": "#e74c7a",
            "phonetic": [
              "/kʊd/",
              "/juː/",
              "/ræp/",
              "/ɪt/",
              "/ʌp/"
            ],
            "pos": "动词短语",
            "meaning": "你能包起来"
          },
          {
            "role": "对象状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/fɔːr/",
              "/miː/"
            ],
            "pos": "介词短语",
            "meaning": "帮我"
          }
        ],
        "explanations": [
          "**wrap sth up** = 把……包起来（wrap up 可分离，代词放中间）。常见错误：\n• \"wrap up **it**\" → 代词 it/them 放中间：wrap it up\n• \"wrap it **in**\" → 需要 in + 包装材料，但这里表完成用 up",
          "送礼语境常用。店员的确认：Would you like me to wrap it? / 加 gift wrapping（礼品包装）"
        ]
      },
      {
        "sentence": "Can I pay with my phone?",
        "cid": "d6d76e5b",
        "translation": "我可以手机支付吗？",
        "chunks": [
          "Can I pay",
          "with my phone?"
        ],
        "hints": [
          "我可以付款吗",
          "用我的手机"
        ],
        "grammar": [
          {
            "role": "情态主谓",
            "color": "#e74c7a",
            "phonetic": [
              "/kæn/",
              "/aɪ/",
              "/peɪ/"
            ],
            "pos": "请求句型",
            "meaning": "我可以付款吗"
          },
          {
            "role": "方式状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/wɪð/",
              "/maɪ/",
              "/foʊn/"
            ],
            "pos": "介词短语",
            "meaning": "用我的手机"
          }
        ],
        "explanations": [
          "支付方式介词辨析：**by** credit card / **with** my phone（用具体工具）→ 两者界限模糊时 with 更保险。常见错误：\n• \"pay **by** my phone\" → 手机上支付叫 pay by phone，拿手机刷叫 pay with my phone\n• \"pay **use** my phone\" → 动词并列需 pay using",
          "移动支付常见词：mobile payment / scan the QR code（扫码）/ Alipay / WeChat Pay。"
        ]
      },
      {
        "sentence": "Do you have a membership card?",
        "cid": "44614ab3",
        "translation": "请问需要会员卡吗？",
        "chunks": [
          "Do you have",
          "a membership card?"
        ],
        "hints": [
          "你有",
          "会员卡吗"
        ],
        "grammar": [
          {
            "role": "一般疑问句",
            "color": "#e74c7a",
            "phonetic": [
              "/duː/",
              "/juː/",
              "/hæv/"
            ],
            "pos": "疑问句",
            "meaning": "你有"
          },
          {
            "role": "宾语",
            "color": "#3358e0",
            "phonetic": [
              "/ə/",
              "/ˈmembərʃɪp/",
              "/kɑːrd/"
            ],
            "pos": "名词短语",
            "meaning": "会员卡"
          }
        ],
        "explanations": [
          "**membership card** = 会员卡。常见错误：\n• \"member **'s** card\" → 名词定语直接用 membership\n• \"member **ship**\" → 一词：membership 会员资格",
          "积分/折扣语境：Do you have a loyalty card? / Earn points（积分）/ 若没卡：Can I sign up for one?（能办一张吗？）"
        ]
      },
      {
        "sentence": "It doesn't fit me well.",
        "cid": "2bccbf9f",
        "translation": "这件我穿着不合身。",
        "chunks": [
          "It doesn't fit",
          "me well."
        ],
        "hints": [
          "它不合身",
          "我穿着"
        ],
        "grammar": [
          {
            "role": "主句谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/ɪt/",
              "/ˈdʌznt/",
              "/fɪt/"
            ],
            "pos": "否定句",
            "meaning": "它不合身"
          },
          {
            "role": "宾语+状语",
            "color": "#3358e0",
            "phonetic": [
              "/miː/",
              "/wel/"
            ],
            "pos": "代词+副词",
            "meaning": "我穿着"
          }
        ],
        "explanations": [
          "**fit** = 合身（尺寸），主语是衣服。常见错误：\n• \"It isn't fit me\" → fit 是动词，否定用 doesn't\n• \"It doesn't fit **to** me\" → fit 直接接人，不加 to",
          "辨析三个词：**fit**（合身尺寸）/ **suit**（适合气质风格）/ **match**（颜色搭配）。This color suits you. 颜色衬你。"
        ]
      },
      {
        "sentence": "Could you show me the latest one?",
        "cid": "0ba46f6f",
        "translation": "能给我看看最新款吗？",
        "chunks": [
          "Could you show me",
          "the latest one?"
        ],
        "hints": [
          "你能给我看",
          "最新款"
        ],
        "grammar": [
          {
            "role": "情态+双宾",
            "color": "#e74c7a",
            "phonetic": [
              "/kʊd/",
              "/juː/",
              "/ʃoʊ/",
              "/miː/"
            ],
            "pos": "情态动词+双宾语",
            "meaning": "你能给我看"
          },
          {
            "role": "宾语",
            "color": "#3358e0",
            "phonetic": [
              "/ðə/",
              "/ˈleɪtɪst/",
              "/wʌn/"
            ],
            "pos": "名词短语",
            "meaning": "最新款"
          }
        ],
        "explanations": [
          "**show sb sth** = show sth to sb，双宾结构。常见错误：\n• \"show **to me** the latest\" → 也正确但 show me 更口语\n• \"show me **lastest**\" → 拼写是 latest（无 lastest 一词）",
          "**the latest one** = 最新款，one 代替前面提到的商品避免重复。latest 也可接型号：the latest model。"
        ]
      },
      {
        "sentence": "Is there a warranty on this watch?",
        "cid": "fa0974dd",
        "translation": "这款手表有保修吗？",
        "chunks": [
          "Is there a warranty",
          "on this watch?"
        ],
        "hints": [
          "有保修",
          "在这款手表上"
        ],
        "grammar": [
          {
            "role": "存在句",
            "color": "#e74c7a",
            "phonetic": [
              "/ɪz/",
              "/ðer/",
              "/ə/",
              "/ˈwɒrənti/"
            ],
            "pos": "there be 疑问",
            "meaning": "有保修吗"
          },
          {
            "role": "地点状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/ɒn/",
              "/ðɪs/",
              "/wɒtʃ/"
            ],
            "pos": "介词短语",
            "meaning": "在这款手表上"
          }
        ],
        "explanations": [
          "**warranty** = 保修（期）/质保，比 guarantee 更常用于电子产品。常见错误：\n• \"warrant\" → warrant 是动词/名词「授权」，保修是 warranty\n• \"How long is the warranty?\" → 问保修期多长",
          "相关：under warranty（在保修期内）/ It comes with a one-year warranty.（一年保修。）"
        ]
      },
      {
        "sentence": "I'm looking for something for my mom.",
        "cid": "a5220aa4",
        "translation": "我想给我妈妈买个东西。",
        "chunks": [
          "I'm looking for something",
          "for my mom."
        ],
        "hints": [
          "我在找某样东西",
          "给我妈妈"
        ],
        "grammar": [
          {
            "role": "主句谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/aɪm/",
              "/ˈlʊkɪŋ/",
              "/fɔːr/",
              "/ˈsʌmθɪŋ/"
            ],
            "pos": "现在进行时",
            "meaning": "我在找某样东西"
          },
          {
            "role": "目的状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/fɔːr/",
              "/maɪ/",
              "/mɒm/"
            ],
            "pos": "介词短语",
            "meaning": "给我妈妈"
          }
        ],
        "explanations": [
          "**look for** = 寻找（强调过程）；**find** = 找到（强调结果）。常见错误：\n• \"I'm looking **at** something for\" → look at 是看，找东西用 look for\n• \"looking for something **to** my mom\" → 给谁买用 for",
          "店员会问：What kind of thing are you looking for? 回答给谁买+预算+用途即可。"
        ]
      },
      {
        "sentence": "Do you offer free delivery?",
        "cid": "4993d618",
        "translation": "你们免费配送吗？",
        "chunks": [
          "Do you offer",
          "free delivery?"
        ],
        "hints": [
          "你们提供",
          "免费配送吗"
        ],
        "grammar": [
          {
            "role": "一般疑问句",
            "color": "#e74c7a",
            "phonetic": [
              "/duː/",
              "/juː/",
              "/ˈɒfər/"
            ],
            "pos": "疑问句",
            "meaning": "你们提供"
          },
          {
            "role": "宾语",
            "color": "#3358e0",
            "phonetic": [
              "/friː/",
              "/dɪˈlɪvəri/"
            ],
            "pos": "名词短语",
            "meaning": "免费配送"
          }
        ],
        "explanations": [
          "**delivery** = 配送/快递（动词 deliver）。常见错误：\n• \"deliver **ing** free\" → 作名词用 delivery\n• \"free **deliver**\" → deliver 是动词，需要名词 delivery",
          "网购高频：free delivery / shipping cost（运费）/ delivery time（配送时间）/ Do you ship internationally?（国际配送吗？）"
        ]
      },
      {
        "sentence": "Can I have a receipt, please?",
        "cid": "cd506d36",
        "translation": "请给我开张小票。",
        "chunks": [
          "Can I have",
          "a receipt,",
          "please?"
        ],
        "hints": [
          "我能要",
          "一张小票",
          "麻烦"
        ],
        "grammar": [
          {
            "role": "情态主谓",
            "color": "#e74c7a",
            "phonetic": [
              "/kæn/",
              "/aɪ/",
              "/hæv/"
            ],
            "pos": "请求句型",
            "meaning": "我能要"
          },
          {
            "role": "宾语",
            "color": "#3358e0",
            "phonetic": [
              "/ə/",
              "/rɪˈsiːt/"
            ],
            "pos": "名词短语",
            "meaning": "一张小票"
          },
          {
            "role": "礼貌词",
            "color": "#7c5cbf",
            "phonetic": [
              "/pliːz/"
            ],
            "pos": "语气词",
            "meaning": "麻烦"
          }
        ],
        "explanations": [
          "**Can I have...?** = 能给我……吗？比 Can I get 更礼貌正式。常见错误：\n• \"Can I have **a receipt please**\" → please 前应有逗号（口语无妨，书面规范）\n• \"Can I **get to** have\" → get/have 二选一",
          "**receipt** 发音 /rɪˈsiːt/，p 不发音！这是最常读错的词之一。可数名词前要加 a。"
        ]
      },
      {
        "sentence": "How much is it in total?",
        "cid": "79421135",
        "translation": "一共多少钱？",
        "chunks": [
          "How much is it",
          "in total?"
        ],
        "hints": [
          "多少钱",
          "总共"
        ],
        "grammar": [
          {
            "role": "主句谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/haʊ/",
              "/mʌtʃ/",
              "/ɪz/",
              "/ɪt/"
            ],
            "pos": "价格疑问",
            "meaning": "多少钱"
          },
          {
            "role": "状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/ɪn/",
              "/ˈtoʊtl/"
            ],
            "pos": "固定短语",
            "meaning": "总共"
          }
        ],
        "explanations": [
          "**in total** = 总共（合计）。常见错误：\n• \"How much **are** it\" → it 是单数，用 is\n• \"in **the** total\" → 固定搭配不加 the",
          "结账相关：That comes to twenty dollars. / altogether（一起）。收银员会确认：Your total is...（您的总计是……）"
        ]
      },
      {
        "sentence": "Could I exchange it for a bigger one?",
        "cid": "1a0d45be",
        "translation": "我能换个大一号的吗？",
        "chunks": [
          "Could I exchange it",
          "for a bigger one?"
        ],
        "hints": [
          "我能换它",
          "换个大一号的"
        ],
        "grammar": [
          {
            "role": "情态主谓",
            "color": "#e74c7a",
            "phonetic": [
              "/kʊd/",
              "/aɪ/",
              "/ɪksˈtʃeɪndʒ/",
              "/ɪt/"
            ],
            "pos": "委婉请求",
            "meaning": "我能换它"
          },
          {
            "role": "目的状语",
            "color": "#7c5cbf",
            "phonetic": [
              "/fɔːr/",
              "/ə/",
              "/ˈbɪɡər/",
              "/wʌn/"
            ],
            "pos": "介词短语",
            "meaning": "换个更大号的"
          }
        ],
        "explanations": [
          "**exchange A for B** = 把 A 换成 B（固定搭配 for）。常见错误：\n• \"exchange it **to** a bigger\" → 换「成」用 for，不用 to\n• \"exchange it **with**\" → with 是「和某人换」，不是换货",
          "退换区分：**return**（退货退款）/ **exchange**（换货）。店家常问换什么尺码：What size would you like to exchange it for?"
        ]
      },
      {
        "sentence": "Is this the final price?",
        "cid": "31c49222",
        "translation": "这是最终价了吗？（还能便宜吗？）",
        "chunks": [
          "Is this",
          "the final price?"
        ],
        "hints": [
          "这是",
          "最终价格吗"
        ],
        "grammar": [
          {
            "role": "主系",
            "color": "#c87033",
            "phonetic": [
              "/ɪz/",
              "/ðɪs/"
            ],
            "pos": "一般疑问句",
            "meaning": "这是"
          },
          {
            "role": "表语",
            "color": "#3358e0",
            "phonetic": [
              "/ðə/",
              "/ˈfaɪnl/",
              "/praɪs/"
            ],
            "pos": "名词短语",
            "meaning": "最终价格"
          }
        ],
        "explanations": [
          "**final price** = 最终价/一口价。砍价场景常见：\n• \"the **finally** price\" → 用形容词 final\n• \"last price\" → 也有此意（最后价），但 final price 更标准",
          "砍价常用句式：Can you do better than that? / What's your best price? / Is that the best you can do?"
        ]
      },
      {
        "sentence": "I'd rather go for the cheaper one.",
        "cid": "72a8211b",
        "translation": "我宁愿要那个便宜点的。",
        "chunks": [
          "I'd rather go for",
          "the cheaper one."
        ],
        "hints": [
          "我宁愿选",
          "那个更便宜的"
        ],
        "grammar": [
          {
            "role": "主句谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/aɪd/",
              "/ˈrɑːðər/",
              "/ɡəʊ/",
              "/fɔːr/"
            ],
            "pos": "would rather 结构",
            "meaning": "我宁愿选"
          },
          {
            "role": "宾语",
            "color": "#3358e0",
            "phonetic": [
              "/ðə/",
              "/ˈtʃiːpər/",
              "/wʌn/"
            ],
            "pos": "名词短语",
            "meaning": "那个更便宜的"
          }
        ],
        "explanations": [
          "**would rather do** = 宁愿做……，后接动词原形。常见错误：\n• \"I'd rather **to** go\" → rather 后接原形不加 to\n• \"I'd rather **going**\" → 用原形 go",
          "**go for** = 选择（口语）。同义：I'll take this one. / I'd like to go with the cheaper one."
        ]
      },
      {
        "sentence": "The price seems a little high.",
        "cid": "7c63ccd9",
        "translation": "价格似乎有点高。",
        "chunks": [
          "The price seems",
          "a little high."
        ],
        "hints": [
          "价格似乎",
          "有点高"
        ],
        "grammar": [
          {
            "role": "主语+系动词",
            "color": "#c87033",
            "phonetic": [
              "/ðə/",
              "/praɪs/",
              "/siːmz/"
            ],
            "pos": "主系表",
            "meaning": "价格似乎"
          },
          {
            "role": "表语",
            "color": "#3358e0",
            "phonetic": [
              "/ə/",
              "/ˈlɪtl/",
              "/haɪ/"
            ],
            "pos": "程度+形容词",
            "meaning": "有点高"
          }
        ],
        "explanations": [
          "**seem + 形容词** = 看起来/似乎……。常见错误：\n• \"seems **is** high\" → seem 已是系动词，不叠加 is\n• \"price is seem high\" → 语序反了",
          "**a little** 修饰形容词表「有点」。砍价前先抱怨价格：That's more than I expected.（超出我的预期。）"
        ]
      },
      {
        "sentence": "Is this the only size you have?",
        "cid": "286efe6b",
        "translation": "你们只有这一个尺码吗？",
        "chunks": [
          "Is this the only size",
          "you have?"
        ],
        "hints": [
          "这是唯一尺码吗",
          "你们有的"
        ],
        "grammar": [
          {
            "role": "主句",
            "color": "#c87033",
            "phonetic": [
              "/ɪz/",
              "/ðɪs/",
              "/ðə/",
              "/ˈoʊnli/",
              "/saɪz/"
            ],
            "pos": "主系表",
            "meaning": "这是唯一尺码吗"
          },
          {
            "role": "定语从句",
            "color": "#3358e0",
            "phonetic": [
              "/juː/",
              "/hæv/"
            ],
            "pos": "定语从句（省略 that）",
            "meaning": "你们有的"
          }
        ],
        "explanations": [
          "**the only + 名词 + (that) 从句**：关系代词 that 作宾语可省略。常见错误：\n• \"the only size **what** you have\" → 定语从句用 that/which，不用 what\n• \"the **only** size\" → only 强调「唯一」，别漏",
          "当尺码/颜色不全时问：Do you have this in any other sizes? / When will you get more in stock?（什么时候补货？）"
        ]
      },
      {
        "sentence": "What's up?",
        "cid": "243188cb",
        "translation": "怎么了？/最近怎么样？",
        "chunks": [
          "What's",
          "up?"
        ],
        "hints": [
          "什么",
          "情况"
        ],
        "grammar": [
          {
            "role": "主语",
            "color": "#c87033",
            "phonetic": [
              "/wɒts/"
            ],
            "pos": "缩略形式",
            "meaning": "What is"
          },
          {
            "role": "副词",
            "color": "#7c5cbf",
            "phonetic": [
              "/ʌp/"
            ],
            "pos": "副词",
            "meaning": "发生/进行中"
          }
        ],
        "explanations": [
          "**What's up?** 是\"怎么了？\"或\"最近怎么样？\"的万能问候。比 \"How are you?\" 更随意、更口语化。",
          "回答可以说 \"Not much.\"（没什么）、\"Just hanging out.\"（随便逛逛）或者反问 \"Not much, what's up with you?\""
        ]
      },
      {
        "sentence": "No problem.",
        "cid": "3d04d4e1",
        "translation": "没问题/不客气。",
        "chunks": [
          "No",
          "problem."
        ],
        "hints": [
          "没有",
          "问题"
        ],
        "grammar": [
          {
            "role": "限定词",
            "color": "#7c5cbf",
            "phonetic": [
              "/nəʊ/"
            ],
            "pos": "否定词",
            "meaning": "没有"
          },
          {
            "role": "名词",
            "color": "#3358e0",
            "phonetic": [
              "/ˈprɒbləm/"
            ],
            "pos": "名词",
            "meaning": "问题"
          }
        ],
        "explanations": [
          "**No problem.** 可以回应感谢（= You're welcome）也可以答应请求（= Sure / Of course）。",
          "比 \"You're welcome\" 更轻松随意，朋友之间最常用。"
        ]
      },
      {
        "sentence": "I'll take it.",
        "cid": "72aa19b1",
        "translation": "我就要这个了/我买了。",
        "chunks": [
          "I'll",
          "take it."
        ],
        "hints": [
          "我将",
          "拿它"
        ],
        "grammar": [
          {
            "role": "主语+助动词",
            "color": "#c87033",
            "phonetic": [
              "/aɪl/"
            ],
            "pos": "将来时",
            "meaning": "我将"
          },
          {
            "role": "谓语+宾语",
            "color": "#e74c7a",
            "phonetic": [
              "/teɪk/",
              "/ɪt/"
            ],
            "pos": "动词短语",
            "meaning": "买下它"
          }
        ],
        "explanations": [
          "**I'll take it.** 购物时决定购买某物的标准表达。",
          "也可以说 **I'll get this one.** 或 **I'd like to buy this.** 但 \"I'll take it.\" 最地道、最常用。"
        ]
      },
      {
        "sentence": "Let me think about it.",
        "cid": "f50d7898",
        "translation": "让我考虑一下。",
        "chunks": [
          "Let me",
          "think about it."
        ],
        "hints": [
          "让我",
          "想想这件事"
        ],
        "grammar": [
          {
            "role": "祈使结构",
            "color": "#c87033",
            "phonetic": [
              "/let/",
              "/miː/"
            ],
            "pos": "使役动词",
            "meaning": "让我"
          },
          {
            "role": "谓语短语",
            "color": "#e74c7a",
            "phonetic": [
              "/θɪŋk/",
              "/əˈbaʊt/",
              "/ɪt/"
            ],
            "pos": "动词短语",
            "meaning": "考虑一下"
          }
        ],
        "explanations": [
          "**Let me think about it.** 委婉地表示需要时间考虑，不直接拒绝。",
          "在谈价格、做决定时非常常用。比直接说 \"No\" 礼貌得多。"
        ]
      },
      {
        "sentence": "It doesn't matter.",
        "cid": "c427a713",
        "translation": "没关系/不要紧。",
        "chunks": [
          "It doesn't",
          "matter."
        ],
        "hints": [
          "这并不",
          "重要"
        ],
        "grammar": [
          {
            "role": "主语+否定",
            "color": "#c87033",
            "phonetic": [
              "/ɪt/",
              "/ˈdʌznt/"
            ],
            "pos": "主语+助动词",
            "meaning": "它不"
          },
          {
            "role": "谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/ˈmætər/"
            ],
            "pos": "动词",
            "meaning": "重要"
          }
        ],
        "explanations": [
          "**It doesn't matter.** 安慰别人或表示自己不在意时的常用语。",
          "类似表达：**No worries.**（更随意）/**That's OK.**（更温和）/**Forget it.**（算了，别提了）"
        ]
      },
      {
        "sentence": "Are you kidding?",
        "cid": "0f9400f7",
        "translation": "你在开玩笑吧？/真的假的？",
        "chunks": [
          "Are you",
          "kidding?"
        ],
        "hints": [
          "你",
          "开玩笑吗"
        ],
        "grammar": [
          {
            "role": "系动词+主语",
            "color": "#c87033",
            "phonetic": [
              "/ɑːr/",
              "/juː/"
            ],
            "pos": "疑问句",
            "meaning": "你是否"
          },
          {
            "role": "现在分词",
            "color": "#e74c7a",
            "phonetic": [
              "/ˈkɪdɪŋ/"
            ],
            "pos": "现在分词",
            "meaning": "开玩笑"
          }
        ],
        "explanations": [
          "**Are you kidding?** 表示惊讶、难以置信。语气取决于上下文——可以是好玩也可以是震惊。",
          "类似表达：**You're joking!** /**Seriously?** /**For real?**（更年轻化）"
        ]
      },
      {
        "sentence": "Sounds good to me.",
        "cid": "0f83a993",
        "translation": "我觉得可以/听起来不错。",
        "chunks": [
          "Sounds good",
          "to me."
        ],
        "hints": [
          "听起来好",
          "对我来说"
        ],
        "grammar": [
          {
            "role": "主谓结构",
            "color": "#c87033",
            "phonetic": [
              "/saʊndz/",
              "/ɡʊd/"
            ],
            "pos": "系动词+形容词",
            "meaning": "听起来不错"
          },
          {
            "role": "介词短语",
            "color": "#7c5cbf",
            "phonetic": [
              "/tuː/",
              "/miː/"
            ],
            "pos": "介词短语",
            "meaning": "对我而言"
          }
        ],
        "explanations": [
          "**Sounds good to me.** 同意提议时最自然的表达之一。",
          "简短版：**Sounds good.** / **Works for me.** / **I'm down with that.**（更年轻）"
        ]
      },
      {
        "sentence": "I'm not sure about that.",
        "cid": "806439ee",
        "translation": "我不太确定那件事。",
        "chunks": [
          "I'm not sure",
          "about that."
        ],
        "hints": [
          "我不确定",
          "关于那个"
        ],
        "grammar": [
          {
            "role": "主语+否定",
            "color": "#c87033",
            "phonetic": [
              "/aɪm/",
              "/nɒt/",
              "/ʃʊər/"
            ],
            "pos": "主语+be+形容词",
            "meaning": "我不确定"
          },
          {
            "role": "介词短语",
            "color": "#7c5cbf",
            "phonetic": [
              "/əˈbaʊt/",
              "/ðæt/"
            ],
            "pos": "介词短语",
            "meaning": "关于那件事"
          }
        ],
        "explanations": [
          "**I'm not sure about that.** 委婉地表达不确定或保留意见。",
          "比直接说 \"I don't know.\" 或 \"No.\" 更礼貌、更有回旋余地。"
        ]
      },
      {
        "sentence": "Can you give me a hand?",
        "cid": "a71c1752",
        "translation": "能帮我一下吗？",
        "chunks": [
          "Can you give me",
          "a hand?"
        ],
        "hints": [
          "你能给我",
          "一个手吗"
        ],
        "grammar": [
          {
            "role": "情态+宾语",
            "color": "#c87033",
            "phonetic": [
              "/kæn/",
              "/juː/",
              "/ɡɪv/",
              "/miː/"
            ],
            "pos": "情态动词+双宾语",
            "meaning": "你能给我"
          },
          {
            "role": "名词短语",
            "color": "#3358e0",
            "phonetic": [
              "/ə/",
              "/hænd/"
            ],
            "pos": "习语",
            "meaning": "帮忙（习语）"
          }
        ],
        "explanations": [
          "**give someone a hand** = 帮某人忙，是固定搭配（习语），不是真的要一只手。",
          "其他求助说法：**Could you help me out?**（更正式）/ **Do me a favor?**（更亲密）"
        ]
      },
      {
        "sentence": "I'm looking forward to it.",
        "cid": "afa391b8",
        "translation": "我很期待。",
        "chunks": [
          "I'm looking",
          "forward to it."
        ],
        "hints": [
          "我在期待",
          "着它"
        ],
        "grammar": [
          {
            "role": "主语+进行时",
            "color": "#c87033",
            "phonetic": [
              "/aɪm/",
              "/lʊkɪŋ/"
            ],
            "pos": "现在进行时",
            "meaning": "我正在期待"
          },
          {
            "role": "固定搭配",
            "color": "#e74c7a",
            "phonetic": [
              "/ˈfɔːrwərd/",
              "/tuː/",
              "/ɪt/"
            ],
            "pos": "介词短语",
            "meaning": "期待着它"
          }
        ],
        "explanations": [
          "**look forward to** 中 **to** 是介词，后面要接名词或动名词（-ing）。常见错误：look forward to *see* → 应为 *seeing*。",
          "用于回复邀请、约定等场景：See you tomorrow! — **I'm looking forward to it!**"
        ]
      },
      {
        "sentence": "I don't care.",
        "cid": "85fb293b",
        "translation": "我不在乎。",
        "chunks": [
          "I don't",
          "care."
        ],
        "hints": [
          "我不",
          "在乎"
        ],
        "grammar": [
          {
            "role": "主语+否定",
            "color": "#c87033",
            "phonetic": [
              "/aɪ/",
              "/doʊnt/"
            ],
            "pos": "主语+助动词否定",
            "meaning": "我不"
          },
          {
            "role": "谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/ker/"
            ],
            "pos": "动词原形",
            "meaning": "在乎"
          }
        ],
        "explanations": [
          "**I don't care.** 表示「我不在乎」，语气偏直接，朋友间随便用，正式场合慎用。",
          "易混三句：**I don't mind.** = 我不介意（答应请求）；**It doesn't matter.** = 没关系（回应道歉）；**I don't care.** = 我不在乎。care 后可接 about：I don't care about it."
        ]
      },
      {
        "sentence": "You're welcome.",
        "cid": "11e9ed12",
        "translation": "不客气。",
        "chunks": [
          "You're",
          "welcome."
        ],
        "hints": [
          "你是",
          "受欢迎的"
        ],
        "grammar": [
          {
            "role": "主语+be",
            "color": "#c87033",
            "phonetic": [
              "/jʊr/",
              "/ˈwelkəm/"
            ],
            "pos": "主系表结构",
            "meaning": "你（被欢迎）"
          },
          {
            "role": "表语",
            "color": "#3358e0",
            "phonetic": [
              "/ˈwelkəm/"
            ],
            "pos": "形容词",
            "meaning": "受欢迎的"
          }
        ],
        "explanations": [
          "**You're welcome.** 回应 Thank you 的标准说法：比 No problem 正式一点，比 My pleasure 更日常。",
          "常见错误：写成 **You're welcomed**（被动语态，此义不成立）→ 正确是形容词 welcome。单独说 Welcome! 则是「欢迎（到来）」。"
        ]
      },
      {
        "sentence": "That makes sense.",
        "cid": "e14abd85",
        "translation": "有道理/说得通。",
        "chunks": [
          "That makes",
          "sense."
        ],
        "hints": [
          "那说得出",
          "道理"
        ],
        "grammar": [
          {
            "role": "主谓",
            "color": "#e74c7a",
            "phonetic": [
              "/ðæt/",
              "/meɪks/"
            ],
            "pos": "主语+谓语",
            "meaning": "那（说）"
          },
          {
            "role": "宾语（习语）",
            "color": "#3358e0",
            "phonetic": [
              "/sens/"
            ],
            "pos": "名词",
            "meaning": "道理"
          }
        ],
        "explanations": [
          "**make sense** = 说得通、有道理，固定搭配。**That makes sense.** 是回应他人解释时最自然的认可句。",
          "否定：**That doesn't make sense.**（说不通）。同义替换：That's reasonable / I see what you mean."
        ]
      },
      {
        "sentence": "I can't agree more.",
        "cid": "c3147310",
        "translation": "我完全同意。",
        "chunks": [
          "I can't",
          "agree more."
        ],
        "hints": [
          "我不能（再）",
          "更同意"
        ],
        "grammar": [
          {
            "role": "主语+否定",
            "color": "#c87033",
            "phonetic": [
              "/aɪ/",
              "/kænt/"
            ],
            "pos": "主语+助动词",
            "meaning": "我不能（再）"
          },
          {
            "role": "谓语",
            "color": "#e74c7a",
            "phonetic": [
              "/əˈɡriː/",
              "/mɔːr/"
            ],
            "pos": "动词+程度比较",
            "meaning": "更同意"
          }
        ],
        "explanations": [
          "**I can't agree more.** 字面「不能再更同意」= 完全同意，是加强同意的惯用表达。",
          "同义：**I couldn't agree more.** 常见错误：\"I can't agree **no** more\" → 双重否定错误；应为 can't ... more。"
        ]
      },
      {
        "sentence": "It's up to you.",
        "cid": "fb54ce6f",
        "translation": "由你决定。",
        "chunks": [
          "It's up",
          "to you."
        ],
        "hints": [
          "取决于",
          "由你"
        ],
        "grammar": [
          {
            "role": "主系结构",
            "color": "#c87033",
            "phonetic": [
              "/ɪts/",
              "/ʌp/"
            ],
            "pos": "主系+副词",
            "meaning": "取决于"
          },
          {
            "role": "介词短语",
            "color": "#7c5cbf",
            "phonetic": [
              "/tuː/",
              "/juː/"
            ],
            "pos": "介词短语",
            "meaning": "由你"
          }
        ],
        "explanations": [
          "**It's up to you.** = 由你决定/你说了算，把选择权交给对方。点餐、约时间的高频句。",
          "扩展：**It's up to sb to do sth** = 由某人负责做某事。问句 **What's up?**（怎么了）与本句无关，注意区分。"
        ]
      },
      {
        "sentence": "I'm on my way.",
        "cid": "d1a382b8",
        "translation": "我在路上了。",
        "chunks": [
          "I'm on",
          "my way."
        ],
        "hints": [
          "我正在",
          "路上"
        ],
        "grammar": [
          {
            "role": "主系+介词",
            "color": "#c87033",
            "phonetic": [
              "/aɪm/",
              "/ɒn/"
            ],
            "pos": "主系结构",
            "meaning": "我正在"
          },
          {
            "role": "名词短语",
            "color": "#3358e0",
            "phonetic": [
              "/maɪ/",
              "/weɪ/"
            ],
            "pos": "名词短语",
            "meaning": "路上"
          }
        ],
        "explanations": [
          "**on my way** = 在（赶往）途中，回复「你到哪了？」时最常用。",
          "扩展：**on the way to + 地点** 强调途中顺路：On the way to work, I grab a coffee. **on the way** 则强调「在途中」。"
        ]
      },
      {
        "sentence": "Don't worry about it.",
        "cid": "ea178218",
        "translation": "别担心/没事的。",
        "chunks": [
          "Don't worry",
          "about it."
        ],
        "hints": [
          "别担心",
          "关于这件事"
        ],
        "grammar": [
          {
            "role": "祈使否定",
            "color": "#e74c7a",
            "phonetic": [
              "/doʊnt/",
              "/ˈwɜːri/"
            ],
            "pos": "否定祈使句",
            "meaning": "别担心"
          },
          {
            "role": "介词短语",
            "color": "#7c5cbf",
            "phonetic": [
              "/əˈbaʊt/",
              "/ɪt/"
            ],
            "pos": "介词短语",
            "meaning": "关于这件事"
          }
        ],
        "explanations": [
          "**Don't worry about it.** = 别担心/没事，宽慰对方的标准说法，也可用来回应道歉（= 没关系）。",
          "口语更短版：**No worries.**（澳洲口语最爱）/ **It's fine.** 别写成 Don't worries（worry 动词不加 s）。"
        ]
      },
      {
        "sentence": "Long time no see.",
        "cid": "e53f3d82",
        "translation": "好久不见。",
        "chunks": [
          "Long time",
          "no see."
        ],
        "hints": [
          "很长时间",
          "没见"
        ],
        "grammar": [
          {
            "role": "名词短语",
            "color": "#3358e0",
            "phonetic": [
              "/lɔːŋ/",
              "/taɪm/"
            ],
            "pos": "名词短语",
            "meaning": "很长时间"
          },
          {
            "role": "省略句（习语）",
            "color": "#e74c7a",
            "phonetic": [
              "/noʊ/",
              "/siː/"
            ],
            "pos": "口语习语",
            "meaning": "没见"
          }
        ],
        "explanations": [
          "**Long time no see.** = 好久不见。虽有中文来源，但已被英语完全接纳，是地道寒暄。",
          "更正式的说法：**It's been a long time / It's been ages.** 回应：Yeah, how have you been?（你最近怎么样？）"
        ]
      },
      {
        "sentence": "Take your time.",
        "cid": "22a86a18",
        "translation": "慢慢来/别着急。",
        "chunks": [
          "Take your",
          "time."
        ],
        "hints": [
          "慢慢用你的",
          "时间"
        ],
        "grammar": [
          {
            "role": "祈使+限定",
            "color": "#e74c7a",
            "phonetic": [
              "/teɪk/",
              "/jɔːr/"
            ],
            "pos": "祈使句",
            "meaning": "慢慢（用）你的"
          },
          {
            "role": "宾语",
            "color": "#3358e0",
            "phonetic": [
              "/taɪm/"
            ],
            "pos": "名词",
            "meaning": "时间"
          }
        ],
        "explanations": [
          "**Take your time.** = 慢慢来、不用急，对方需要时间思考或忙时安慰用。",
          "结构 take one's time：take my time / take his time。反义：**Hurry up!** 别与 **It takes time**（需要时间）混淆。"
        ]
      },
      {
        "sentence": "It's a deal.",
        "cid": "a964fa8d",
        "translation": "一言为定/成交。",
        "chunks": [
          "It's",
          "a deal."
        ],
        "hints": [
          "这是",
          "一桩成交"
        ],
        "grammar": [
          {
            "role": "主系",
            "color": "#c87033",
            "phonetic": [
              "/ɪts/"
            ],
            "pos": "主系结构",
            "meaning": "这是"
          },
          {
            "role": "表语（习语）",
            "color": "#3358e0",
            "phonetic": [
              "/ə/",
              "/diːl/"
            ],
            "pos": "名词短语",
            "meaning": "一言为定"
          }
        ],
        "explanations": [
          "**It's a deal.** = 一言为定/成交，用来敲定双方约定。",
          "场景：— Let's meet at three. — **It's a deal!** 更口语的单字版：**Deal!** 双方都同意也可回 **Done.**"
        ]
      },
      {
        "sentence": "It's been a while.",
        "cid": "4fad1198",
        "translation": "已经有一阵子了。",
        "chunks": [
          "It's been",
          "a while."
        ],
        "hints": [
          "已经有",
          "一段时间"
        ],
        "grammar": [
          {
            "role": "主系",
            "color": "#c87033",
            "phonetic": [
              "/ɪts/",
              "/biːn/"
            ],
            "pos": "现在完成时",
            "meaning": "已经有"
          },
          {
            "role": "表语（时间）",
            "color": "#3358e0",
            "phonetic": [
              "/ə/",
              "/waɪl/"
            ],
            "pos": "名词短语",
            "meaning": "一段时间"
          }
        ],
        "explanations": [
          "**It's been a while.** = 已经有一段时间了，常接 since：It's been a while since we met.（我们好久没见了）。",
          "寒暄常用：It's been a while, how have you been? 也可用于提醒：It's been a while since you visited."
        ]
      },
      {
        "sentence": "I'll see what I can do.",
        "cid": "abc317f8",
        "translation": "我看看能做点什么。",
        "chunks": [
          "I'll see",
          "what I can do."
        ],
        "hints": [
          "我会看看",
          "我能做什么"
        ],
        "grammar": [
          {
            "role": "主谓",
            "color": "#e74c7a",
            "phonetic": [
              "/aɪl/",
              "/siː/"
            ],
            "pos": "一般将来时",
            "meaning": "我会看看"
          },
          {
            "role": "宾语从句",
            "color": "#3358e0",
            "phonetic": [
              "/wɒt/",
              "/aɪ/",
              "/kæn/",
              "/duː/"
            ],
            "pos": "名词性从句",
            "meaning": "我能做什么"
          }
        ],
        "explanations": [
          "**I'll see what I can do.** = 我尽量想办法，是不打包票的承诺，比 Yes 留有余地。",
          "宾语从句用陈述语序 what I can do，不倒装。对方语境常是请求帮助时表示愿意尽力。"
        ]
      },
      {
        "sentence": "It slipped my mind.",
        "cid": "d2d4552d",
        "translation": "我一时忘了。",
        "chunks": [
          "It slipped",
          "my mind."
        ],
        "hints": [
          "它溜出了",
          "我的脑海"
        ],
        "grammar": [
          {
            "role": "主谓",
            "color": "#e74c7a",
            "phonetic": [
              "/ɪt/",
              "/slɪpt/"
            ],
            "pos": "一般过去时",
            "meaning": "它（溜出）"
          },
          {
            "role": "宾语（习语）",
            "color": "#3358e0",
            "phonetic": [
              "/maɪ/",
              "/maɪnd/"
            ],
            "pos": "名词短语",
            "meaning": "我的脑海"
          }
        ],
        "explanations": [
          "**slip one's mind** = 被遗忘（事情溜出脑海），是忘记的惯用表达。",
          "常见错误：\"It slipped **in** my mind\" → 不需要 in。忘记做某事也可说 **It completely slipped my mind**（我完全忘了）。"
        ]
      },
      {
        "sentence": "Give it a shot.",
        "cid": "890b2dc4",
        "translation": "试试看吧。",
        "chunks": [
          "Give it",
          "a shot."
        ],
        "hints": [
          "给它（试试）",
          "一次机会"
        ],
        "grammar": [
          {
            "role": "祈使+宾语",
            "color": "#e74c7a",
            "phonetic": [
              "/ɡɪv/",
              "/ɪt/"
            ],
            "pos": "祈使句",
            "meaning": "给它（一次）"
          },
          {
            "role": "宾语（习语）",
            "color": "#3358e0",
            "phonetic": [
              "/ə/",
              "/ʃɒt/"
            ],
            "pos": "名词短语",
            "meaning": "尝试"
          }
        ],
        "explanations": [
          "**give it a shot** = 尝试一下（shot 本义射击，此处引申为尝试）。",
          "同义：give it a try / have a go。鼓励别人尝试新事物很常用：Come on, just give it a shot!"
        ]
      },
      {
        "sentence": "I'll take care of it.",
        "cid": "0ca82ddb",
        "translation": "我来处理。",
        "chunks": [
          "I'll take care",
          "of it."
        ],
        "hints": [
          "我会负责",
          "这件事"
        ],
        "grammar": [
          {
            "role": "主谓",
            "color": "#e74c7a",
            "phonetic": [
              "/aɪl/",
              "/teɪk/",
              "/ker/"
            ],
            "pos": "固定搭配",
            "meaning": "我会负责"
          },
          {
            "role": "介词短语",
            "color": "#7c5cbf",
            "phonetic": [
              "/əv/",
              "/ɪt/"
            ],
            "pos": "介词短语",
            "meaning": "这件事"
          }
        ],
        "explanations": [
          "**take care of** = 处理/照看，短语动词不可拆分。常见错误：\"take care **about** it\" → 固定用 of。",
          "含义随语境变化：处理（事务）/ 照顾（人或宠物）。It's handled. 也是「已搞定」的近义说法。"
        ]
      },
      {
        "sentence": "You said it.",
        "cid": "89d8df40",
        "translation": "你说得没错/正是我想说的。",
        "chunks": [
          "You said",
          "it."
        ],
        "hints": [
          "你说出了",
          "它"
        ],
        "grammar": [
          {
            "role": "主谓",
            "color": "#e74c7a",
            "phonetic": [
              "/juː/",
              "/sed/"
            ],
            "pos": "一般过去时",
            "meaning": "你说出了"
          },
          {
            "role": "宾语",
            "color": "#3358e0",
            "phonetic": [
              "/ɪt/"
            ],
            "pos": "代词",
            "meaning": "它（心声）"
          }
        ],
        "explanations": [
          "**You said it.** = 你说得对/深表赞同，强调对方说出了你的心声。",
          "注意别直译为「你说了它」。语境：— This place is overpriced. — **You said it!**（可不是嘛！）"
        ]
      },
      {
        "sentence": "So far so good.",
        "cid": "d13966c5",
        "translation": "到目前为止都挺好。",
        "chunks": [
          "So far",
          "so good."
        ],
        "hints": [
          "到目前为止",
          "都挺好"
        ],
        "grammar": [
          {
            "role": "状语（习语）",
            "color": "#7c5cbf",
            "phonetic": [
              "/soʊ/",
              "/fɑːr/"
            ],
            "pos": "习语",
            "meaning": "到目前为止"
          },
          {
            "role": "省略表语",
            "color": "#c87033",
            "phonetic": [
              "/soʊ/",
              "/ɡʊd/"
            ],
            "pos": "省略句",
            "meaning": "都挺好"
          }
        ],
        "explanations": [
          "**So far so good.** = 到目前为止一切顺利，常回答别人对进度的询问。",
          "口语省略句，语法上省去了 it's been。书面完整版：So far, everything is going well."
        ]
      },
      {
        "sentence": "Better late than never.",
        "cid": "c556a208",
        "translation": "迟做总比不做好。",
        "chunks": [
          "Better late",
          "than never."
        ],
        "hints": [
          "宁愿晚",
          "也比没有强"
        ],
        "grammar": [
          {
            "role": "谚语前半",
            "color": "#c87033",
            "phonetic": [
              "/ˈbetər/",
              "/leɪt/"
            ],
            "pos": "省略比较句",
            "meaning": "迟做"
          },
          {
            "role": "谚语后半",
            "color": "#3358e0",
            "phonetic": [
              "/ðæn/",
              "/ˈnevər/"
            ],
            "pos": "than+省略",
            "meaning": "比不做好"
          }
        ],
        "explanations": [
          "**Better late than never.** 谚语「迟做总比不做好」，用于安慰迟到/晚到的成果。",
          "结构上是 It's better to be late than never (to do it) 的省略。对比另一谚语：**Never too late to learn**（活到老学到老）。"
        ]
      },
      {
        "sentence": "Keep up the good work.",
        "cid": "10e9ea4a",
        "translation": "继续保持/干得漂亮。",
        "chunks": [
          "Keep up",
          "the good work."
        ],
        "hints": [
          "保持住",
          "这份好工作"
        ],
        "grammar": [
          {
            "role": "祈使+副词",
            "color": "#e74c7a",
            "phonetic": [
              "/kiːp/",
              "/ʌp/"
            ],
            "pos": "短语动词",
            "meaning": "保持住"
          },
          {
            "role": "宾语",
            "color": "#3358e0",
            "phonetic": [
              "/ðə/",
              "/ɡʊd/",
              "/wɜːrk/"
            ],
            "pos": "名词短语",
            "meaning": "好表现"
          }
        ],
        "explanations": [
          "**keep up the good work** = 继续加油/保持好表现，上司表扬下属的高频句。",
          "keep up 后接抽象名词：keep up the pace（保持节奏）。若指「赶上进度」是 catch up，注意区分。"
        ]
      },
      {
        "sentence": "I mean it.",
        "cid": "b6c66834",
        "translation": "我是认真的。",
        "chunks": [
          "I mean",
          "it."
        ],
        "hints": [
          "我说的是",
          "认真的"
        ],
        "grammar": [
          {
            "role": "主谓",
            "color": "#e74c7a",
            "phonetic": [
              "/aɪ/",
              "/miːn/"
            ],
            "pos": "一般现在时",
            "meaning": "我（说）的"
          },
          {
            "role": "宾语",
            "color": "#3358e0",
            "phonetic": [
              "/ɪt/"
            ],
            "pos": "代词",
            "meaning": "它是认真的"
          }
        ],
        "explanations": [
          "**I mean it.** = 我说的是真的/不是在开玩笑，用来强调上一句话的严肃性。",
          "语境：— I'll quit if this continues! — Are you serious? — **I mean it!** 近义：**I'm serious.**"
        ]
      }
    ]
  }
];

/* 内置题库构成：
   - builtins.js 定义 1 deck：builtin-daily(88 静态 = 日常58 + 口头禅30)
   - oral8000.js 文件尾把 50 句 concat 进 builtin-daily → daily 运行态 138 句
   - freq-idioms.js 文件尾自注册 builtin-freq-idioms(103)
   引用页必须按 builtins.js → oral8000.js → freq-idioms.js 顺序加载（见 main.html / decks.html / stats.html）。 */

