/* builtins.js · Chunk Lab 内置题库（4 个 deck，跨页面共享） */
window.BUILTIN = [
  {
    "id": "builtin-daily",
    "builtin": true,
    "name": "日常对话 · Daily Talk",
    "desc": "高频寒暄与生活场景",
    "items": [
      {
        "sentence": "How was your weekend?",
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
      }
    ]
  },
  {
    "id": "builtin-shopping",
    "builtin": true,
    "name": "购物英语 · Shopping",
    "desc": "试穿、砍价、退换货",
    "items": [
      {
        "sentence": "Can I try this on?",
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
      }
    ]
  },
  {
    "id": "builtin-oral-8000",
    "builtin": true,
    "name": "日常口语8000句",
    "desc": "种子库，数据在 oral8000.js",
    "items": []
  },
  {
    "id": "builtin-freq-spoken",
    "builtin": true,
    "name": "高频口语 · Spoken Essentials",
    "desc": "最常用的日常口语表达",
    "items": [
      {
        "sentence": "What's up?",
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
      }
    ]
  }
];

/* 加载时自填"日常口语8000句"的种子数据（来自 oral8000.js） */
(function(){
  var seed = window.DATA_ORAL8000;
  if(!seed || !window.BUILTIN) return;
  for(var i=0; i<window.BUILTIN.length; i++){
    if(window.BUILTIN[i].id === 'builtin-oral-8000'){
      window.BUILTIN[i].items = seed;
      break;
    }
  }
})();
