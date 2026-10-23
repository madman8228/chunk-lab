// src/expression-course/expression-package.schema.json
var expression_package_schema_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://jqka.top/contracts/expression-package-1.0.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["format", "formatVersion", "courseId", "title", "description", "audience", "lessons", "assets", "reviewActivities"],
  properties: {
    format: { const: "chunklab-expression-course" },
    formatVersion: { const: "1.0" },
    courseId: { type: "string", pattern: "^expression-[a-z0-9-]{3,80}$" },
    title: { type: "string", minLength: 2, maxLength: 120 },
    description: { type: "string", maxLength: 1e3 },
    audience: { const: "adult_beginner" },
    lessons: { type: "array", minItems: 1, maxItems: 20, items: { type: "object" } },
    assets: { type: "array", maxItems: 100, items: {
      type: "object",
      additionalProperties: false,
      required: ["assetId", "mimeType", "localFile"],
      properties: {
        assetId: { type: "string", minLength: 1, maxLength: 120 },
        mimeType: { enum: ["audio/mpeg", "audio/ogg", "audio/wav"] },
        sha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
        size: { type: "integer", minimum: 1, maximum: 5242880 },
        localFile: { type: "string", minLength: 1, maxLength: 240 }
      }
    } },
    reviewActivities: { type: "array", minItems: 2, maxItems: 100, items: {
      type: "object",
      additionalProperties: false,
      required: ["lessonId", "skillId", "activityId"],
      properties: {
        lessonId: { type: "string", minLength: 1 },
        skillId: { type: "string", minLength: 1 },
        activityId: { type: "string", minLength: 1 }
      }
    } }
  }
};

// src/expression-course/lesson.schema.json
var lesson_schema_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://example.invalid/zero-english/lesson.schema.json",
  title: "Zero English Lesson Contract v1",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "lessonId",
    "contentVersion",
    "status",
    "locale",
    "title",
    "communicationGoal",
    "prerequisiteSkillIds",
    "taughtSkillIds",
    "vocabulary",
    "audioAssets",
    "activities",
    "reviewPlan"
  ],
  properties: {
    schemaVersion: {
      const: "1.0"
    },
    lessonId: {
      type: "string",
      pattern: "^L[0-9]{3,}$"
    },
    contentVersion: {
      type: "integer",
      minimum: 1
    },
    status: {
      enum: [
        "draft",
        "reviewed",
        "published"
      ]
    },
    locale: {
      const: "zh-CN"
    },
    title: {
      type: "string",
      minLength: 2
    },
    communicationGoal: {
      type: "string",
      minLength: 5
    },
    prerequisiteSkillIds: {
      type: "array",
      uniqueItems: true,
      items: {
        type: "string",
        minLength: 1
      }
    },
    taughtSkillIds: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: {
        type: "string",
        minLength: 1
      }
    },
    vocabulary: {
      type: "array",
      minItems: 2,
      items: {
        $ref: "#/$defs/vocab"
      }
    },
    audioAssets: {
      type: "array",
      items: {
        $ref: "#/$defs/audio"
      }
    },
    activities: {
      type: "array",
      minItems: 7,
      items: {
        $ref: "#/$defs/activity"
      }
    },
    reviewPlan: {
      type: "object",
      additionalProperties: false,
      required: [
        "intervalDays"
      ],
      properties: {
        intervalDays: {
          type: "array",
          minItems: 2,
          items: {
            type: "integer",
            minimum: 1
          }
        }
      }
    }
  },
  $defs: {
    vocab: {
      type: "object",
      additionalProperties: false,
      required: [
        "id",
        "en",
        "zh",
        "introducedHere"
      ],
      properties: {
        id: {
          type: "string",
          minLength: 1
        },
        en: {
          type: "string",
          minLength: 1
        },
        zh: {
          type: "string",
          minLength: 1
        },
        introducedHere: {
          type: "boolean"
        }
      }
    },
    audio: {
      type: "object",
      additionalProperties: false,
      required: [
        "assetId",
        "text",
        "locale",
        "status"
      ],
      properties: {
        assetId: {
          type: "string",
          minLength: 1
        },
        text: {
          type: "string",
          minLength: 1
        },
        locale: {
          const: "en-US"
        },
        status: {
          enum: [
            "needs_generation",
            "ready"
          ]
        },
        path: {
          type: "string",
          minLength: 1
        }
      }
    },
    activity: {
      type: "object",
      additionalProperties: false,
      required: [
        "id",
        "type",
        "stage",
        "prompt",
        "skillIds",
        "payload",
        "evaluation"
      ],
      properties: {
        id: {
          type: "string",
          minLength: 3
        },
        type: {
          enum: [
            "meaning_intro",
            "micro_explanation",
            "sentence_build",
            "substitution",
            "listening_choice",
            "independent_output",
            "transfer_test"
          ]
        },
        stage: {
          enum: [
            "guided",
            "reduced_help",
            "independent",
            "retention"
          ]
        },
        prompt: {
          type: "string",
          minLength: 2
        },
        skillIds: {
          type: "array",
          minItems: 1,
          uniqueItems: true,
          items: {
            type: "string",
            minLength: 1
          }
        },
        payload: {
          type: "object"
        },
        evaluation: {
          type: "object",
          additionalProperties: false,
          required: [
            "countsTowardMastery"
          ],
          properties: {
            countsTowardMastery: {
              type: "boolean"
            },
            acceptedAnswers: {
              type: "array",
              minItems: 1,
              uniqueItems: true,
              items: {
                type: "string",
                minLength: 1
              }
            },
            correctOptionId: {
              type: "string",
              minLength: 1
            },
            caseSensitive: {
              type: "boolean"
            },
            punctuationSensitive: {
              type: "boolean"
            }
          }
        }
      },
      allOf: [
        {
          if: {
            properties: {
              type: {
                const: "meaning_intro"
              }
            }
          },
          then: {
            properties: {
              stage: {
                const: "guided"
              },
              evaluation: {
                properties: {
                  countsTowardMastery: {
                    const: false
                  }
                }
              },
              payload: {
                $ref: "#/$defs/introPayload"
              }
            }
          }
        },
        {
          if: {
            properties: {
              type: {
                const: "micro_explanation"
              }
            }
          },
          then: {
            properties: {
              stage: {
                const: "guided"
              },
              evaluation: {
                properties: {
                  countsTowardMastery: {
                    const: false
                  }
                }
              },
              payload: {
                $ref: "#/$defs/explanationPayload"
              }
            }
          }
        },
        {
          if: {
            properties: {
              type: {
                const: "sentence_build"
              }
            }
          },
          then: {
            properties: {
              payload: {
                $ref: "#/$defs/buildPayload"
              },
              evaluation: {
                required: [
                  "countsTowardMastery",
                  "acceptedAnswers"
                ],
                properties: {
                  countsTowardMastery: {
                    const: false
                  }
                }
              }
            }
          }
        },
        {
          if: {
            properties: {
              type: {
                const: "substitution"
              }
            }
          },
          then: {
            properties: {
              payload: {
                $ref: "#/$defs/situationPayload"
              },
              evaluation: {
                required: [
                  "countsTowardMastery",
                  "acceptedAnswers"
                ],
                properties: {
                  countsTowardMastery: {
                    const: false
                  }
                }
              }
            }
          }
        },
        {
          if: {
            properties: {
              type: {
                const: "listening_choice"
              }
            }
          },
          then: {
            properties: {
              payload: {
                $ref: "#/$defs/listeningPayload"
              },
              evaluation: {
                required: [
                  "countsTowardMastery",
                  "correctOptionId"
                ]
              }
            }
          }
        },
        {
          if: {
            properties: {
              type: {
                const: "independent_output"
              }
            }
          },
          then: {
            properties: {
              stage: {
                const: "independent"
              },
              payload: {
                $ref: "#/$defs/situationPayload"
              },
              evaluation: {
                required: [
                  "countsTowardMastery",
                  "acceptedAnswers"
                ]
              }
            }
          }
        },
        {
          if: {
            properties: {
              type: {
                const: "transfer_test"
              }
            }
          },
          then: {
            properties: {
              stage: {
                enum: [
                  "independent",
                  "retention"
                ]
              },
              payload: {
                $ref: "#/$defs/transferPayload"
              },
              evaluation: {
                required: [
                  "countsTowardMastery",
                  "acceptedAnswers"
                ],
                properties: {
                  countsTowardMastery: {
                    const: true
                  }
                }
              }
            }
          }
        }
      ]
    },
    introPayload: {
      type: "object",
      additionalProperties: false,
      required: [
        "exampleEnglish",
        "exampleZh",
        "audioAssetId"
      ],
      properties: {
        exampleEnglish: {
          type: "string"
        },
        exampleZh: {
          type: "string"
        },
        audioAssetId: {
          type: "string"
        },
        vocabularyPreviewIds: {
          type: "array",
          uniqueItems: true,
          items: {
            type: "string",
            minLength: 1
          }
        }
      }
    },
    explanationPayload: {
      type: "object",
      additionalProperties: false,
      required: [
        "ruleText",
        "contrasts"
      ],
      properties: {
        ruleText: {
          type: "string",
          minLength: 5
        },
        contrasts: {
          type: "array",
          minItems: 2,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "en",
              "zh"
            ],
            properties: {
              en: {
                type: "string"
              },
              zh: {
                type: "string"
              }
            }
          }
        }
      }
    },
    buildPayload: {
      type: "object",
      additionalProperties: false,
      required: [
        "targetMeaning",
        "availableTokens",
        "correctTokens"
      ],
      properties: {
        targetMeaning: {
          type: "string"
        },
        availableTokens: {
          type: "array",
          minItems: 2,
          items: {
            type: "string"
          }
        },
        correctTokens: {
          type: "array",
          minItems: 2,
          items: {
            type: "string"
          }
        }
      }
    },
    situationPayload: {
      type: "object",
      additionalProperties: false,
      required: [
        "scenario",
        "targetMeaning"
      ],
      properties: {
        scenario: {
          type: "string",
          minLength: 3
        },
        targetMeaning: {
          type: "string",
          minLength: 3
        },
        responseModes: {
          type: "array",
          items: {
            enum: [
              "text",
              "record_self_check"
            ]
          },
          uniqueItems: true
        }
      }
    },
    transferPayload: {
      type: "object",
      additionalProperties: false,
      required: [
        "scenario",
        "targetMeaning",
        "withheldExample"
      ],
      properties: {
        scenario: {
          type: "string",
          minLength: 3
        },
        targetMeaning: {
          type: "string",
          minLength: 3
        },
        withheldExample: {
          const: true
        },
        responseModes: {
          type: "array",
          items: {
            enum: [
              "text",
              "record_self_check"
            ]
          },
          uniqueItems: true
        }
      }
    },
    listeningPayload: {
      type: "object",
      additionalProperties: false,
      required: [
        "audioAssetId",
        "options"
      ],
      properties: {
        audioAssetId: {
          type: "string",
          minLength: 1
        },
        options: {
          type: "array",
          minItems: 2,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "textZh"
            ],
            properties: {
              id: {
                type: "string",
                minLength: 1
              },
              textZh: {
                type: "string",
                minLength: 1
              }
            }
          }
        }
      }
    }
  }
};

// src/expression-course/authoring/prompt.mjs
function makeExpressionCoursePrompt() {
  return `\u4F60\u662F\u82F1\u8BED\u53E3\u8BED\u6559\u5B66\u8BFE\u7A0B\u7F16\u5199\u52A9\u624B\u3002\u8BF7\u6839\u636E\u6211\u63D0\u4F9B\u7684\u6559\u6750/\u8D44\u6599\u5236\u4F5C\u9002\u5408\u4E2D\u6587\u6BCD\u8BED\u6210\u4EBA\u96F6\u57FA\u7840\u5B66\u4E60\u8005\u7684\u8BFE\u7A0B\u5019\u9009\u5185\u5BB9\u3002\u8D44\u6599\u4EC5\u7528\u4E8E\u672C\u6B21\u751F\u6210\uFF0C\u4E0D\u5F97\u4F2A\u9020\u6559\u6750\u539F\u6587\u6216\u5F15\u7528\u9875\u7801\u3002

\u8F93\u51FA\u8981\u6C42\uFF1A\u53EA\u8F93\u51FA\u7B26\u5408\u4EE5\u4E0B JSON Schema \u7684\u4E00\u4E2A JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981 Markdown \u4EE3\u7801\u56F4\u680F\u3001\u89E3\u91CA\u6216\u591A\u4F59\u5B57\u6BB5\u3002\u97F3\u9891\u7D20\u6750\u7531\u6211\u53E6\u884C\u63D0\u4F9B\uFF1A\u5728 assets \u4E2D\u586B\u5199 assetId\u3001mimeType\u3001localFile \u6587\u4EF6\u540D\uFF1Bsha256 \u548C size \u4E0D\u8981\u731C\uFF0C\u7559\u7A7A\u4E0D\u7B26\u5408\u89C4\u8303\u65F6\u8BF7\u76F4\u63A5\u7701\u7565\u3002\u7F3A\u5C11\u97F3\u9891\u65F6\u5728\u8BFE\u5185\u97F3\u9891\u6E05\u5355\u6807\u8BB0 needs_generation\uFF1B\u4E0D\u5F97\u4F2A\u9020\u97F3\u9891\u6587\u4EF6\u3002\u5148\u7528 meaning_intro/micro_explanation \u5EFA\u7ACB\u7406\u89E3\uFF0C\u518D\u9010\u6B65\u51CF\u5C11\u63D0\u793A\uFF0C\u52A0\u5165 sentence_build\u3001substitution\u3001listening_choice\u3001independent_output \u548C transfer_test\u3002\u81F3\u5C117\u4E2A\u6D3B\u52A8\uFF1B\u72EC\u7ACB\u8868\u8FBE\u4E0D\u80FD\u51FA\u73B0\u82F1\u6587\u7B54\u6848\u3001\u9996\u5B57\u6BCD\u6216\u53EF\u76F4\u63A5\u6284\u5199\u7684\u8BCD\u5757\u3002\u8FC1\u79FB\u9898\u7528\u65B0\u60C5\u5883\uFF0C\u4E0D\u91CD\u590D\u524D\u9762\u5B8C\u6574\u793A\u8303\u7B54\u6848\u3002reviewActivities \u63D0\u4F9B\u81F3\u5C11\u4E24\u4E2A\u72EC\u7ACB\u7EC3\u4E60\u7EC4\u5408\u3002\u4FDD\u7559\u552F\u4E00 ID\uFF1B\u6240\u6709\u63A5\u53D7\u7B54\u6848\u663E\u5F0F\u5217\u51FA\uFF0C\u4EC5\u5141\u8BB8\u786E\u5B9E\u7B49\u4EF7\u7684\u81EA\u7136\u8868\u8FBE\u3002

\u8BF7\u5148\u5411\u6211\u786E\u8BA4\u8D44\u6599\u4E2D\u4E0D\u660E\u786E\u7684\u76EE\u6807\u3001\u5DF2\u77E5\u8BCD\u6C47\u548C\u96BE\u5EA6\uFF1B\u786E\u8BA4\u540E\u518D\u751F\u6210\u3002\u53D1\u73B0\u7ED3\u6784\u9519\u8BEF\u65F6\u4EC5\u8FD4\u56DE\u4FEE\u590D\u540E\u7684\u5B8C\u6574 JSON\u3002

\u8BFE\u7A0B\u5305 JSON Schema\uFF1A
${JSON.stringify(expression_package_schema_default, null, 2)}

\u5355\u8BFE JSON Schema\uFF1A
${JSON.stringify(lesson_schema_default, null, 2)}`;
}

// src/shared/chunk-selection.mjs
var make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== void 0) node.textContent = text;
  return node;
};
function createChunkSelection({
  mode = "sequence",
  tokens = [],
  targetCount = tokens.length,
  onSelect,
  onSubmit,
  className = "",
  selectedClass = "chunk-selection-selected",
  poolClass = "chunk-selection-pool",
  buttonClass = "chunk-selection-button",
  selectedButtonClass = "",
  selectedLabel = "\u5DF2\u9009\u8BCD\u5757\uFF0C\u70B9\u51FB\u53EF\u64A4\u56DE",
  poolLabel = "\u53EF\u9009\u8BCD\u5757",
  submitOnTarget = true
} = {}) {
  if (!["sequence", "immediate"].includes(mode)) throw new TypeError("Unsupported chunk selection mode");
  const element = make("div", `chunk-selection ${className}`.trim());
  const buttons = /* @__PURE__ */ new Map();
  const textCounts = /* @__PURE__ */ new Map();
  const tokenIndexes = new Map(tokens.map((token, index) => [String(token.id), index]));
  for (const token of tokens) textCounts.set(token.text, (textCounts.get(token.text) || 0) + 1);
  const labelFor = (token, index) => token.ariaLabel || (textCounts.get(token.text) > 1 ? `\u9009\u62E9\u8BCD\u5757\uFF1A${token.text}\uFF08\u7B2C${index + 1}\u5757\uFF09` : `\u9009\u62E9\u8BCD\u5757\uFF1A${token.text}`);
  let selected = [], state = "ready", active = true, destroyed = false, retryButton = null;
  if (mode === "immediate") {
    for (const token of tokens) {
      const button = make("button", `${buttonClass} ${token.className || ""}`.trim(), token.text);
      button.type = "button";
      button.dataset.v = token.value ?? token.text;
      button.dataset.chunkId = String(token.id);
      if (textCounts.get(token.text) > 1 || token.ariaLabel) button.setAttribute("aria-label", labelFor(token, tokenIndexes.get(String(token.id))));
      button.addEventListener("click", () => {
        if (destroyed || !active || button.disabled) return;
        onSelect?.(token, button);
      });
      buttons.set(String(token.id), button);
      element.append(button);
    }
  } else {
    let render = function() {
      selectedNode.replaceChildren();
      poolNode.replaceChildren();
      selectedNode.removeAttribute("aria-invalid");
      selected.forEach((id, index) => {
        const button = buttons.get(id);
        button.className = `${buttonClass} ${selectedButtonClass}`.trim();
        button.setAttribute("aria-label", `\u7B2C${index + 1}\u5757\uFF1A${button.textContent}\uFF0C\u70B9\u6B64\u64A4\u56DE`);
        selectedNode.append(button);
      });
      for (const token of tokens) {
        const id = String(token.id);
        if (selected.includes(id)) continue;
        const button = buttons.get(id);
        button.className = buttonClass;
        button.setAttribute("aria-label", labelFor(token, tokenIndexes.get(id)));
        poolNode.append(button);
      }
    };
    const selectedNode = make("div", `${selectedClass} chunk-selection-selected`.trim());
    const poolNode = make("div", poolClass);
    const feedback = make("span", "chunk-selection-feedback");
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    selectedNode.setAttribute("role", "group");
    selectedNode.setAttribute("aria-label", selectedLabel);
    poolNode.setAttribute("role", "group");
    poolNode.setAttribute("aria-label", poolLabel);
    for (const token of tokens) {
      const button = make("button", buttonClass, token.text);
      button.type = "button";
      button.lang = token.lang || "en";
      button.setAttribute("aria-label", labelFor(token, tokenIndexes.get(String(token.id))));
      button.dataset.chunkId = String(token.id);
      button.addEventListener("click", () => {
        if (destroyed || !active || state === "pending" || state === "success") return;
        const id = String(token.id), index = selected.indexOf(id);
        if (index >= 0) selected.splice(index, 1);
        else if (selected.length < targetCount) selected.push(id);
        feedback.textContent = "";
        render();
        button.focus();
        if (submitOnTarget && selected.length === targetCount) submit();
      });
      buttons.set(String(token.id), button);
      poolNode.append(button);
    }
    async function submit() {
      if (destroyed || !active || state !== "ready" || selected.length !== targetCount) return;
      const snapshot = selected.map((id) => id);
      state = "pending";
      render();
      buttons.forEach((button) => {
        button.disabled = true;
      });
      try {
        const result = await onSubmit?.(snapshot.map((id) => tokens.find((token) => String(token.id) === id)));
        if (destroyed) return;
        if (result === "success" || result?.status === "success") {
          state = "success";
          feedback.textContent = result?.message || "";
          buttons.forEach((button) => {
            button.disabled = true;
          });
        } else if (result === "blocked" || result?.status === "blocked") {
          state = "blocked";
          feedback.textContent = result?.message || "\u5F53\u524D\u65E0\u6CD5\u63D0\u4EA4\uFF0C\u8BF7\u68C0\u67E5\u5B66\u4E60\u6743\u9650\u3002";
          buttons.forEach((button) => {
            button.disabled = true;
          });
        } else if (result === "retryable-error" || result?.status === "retryable-error") {
          state = "retryable-error";
          feedback.textContent = result?.message || "\u63D0\u4EA4\u6682\u65F6\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002";
          retryButton = make("button", "chunk-selection-retry", "\u91CD\u8BD5\u63D0\u4EA4");
          retryButton.type = "button";
          retryButton.onclick = () => {
            retryButton.remove();
            retryButton = null;
            state = "ready";
            submit();
          };
          selectedNode.append(retryButton);
        } else {
          state = "ready";
          feedback.textContent = result?.message || "\u8BCD\u5757\u987A\u5E8F\u8FD8\u4E0D\u5BF9\uFF0C\u70B9\u5DF2\u9009\u8BCD\u5757\u64A4\u56DE\u540E\u91CD\u6392\u3002";
          selectedNode.setAttribute("aria-invalid", "true");
          buttons.forEach((button) => {
            button.disabled = false;
          });
          selectedNode.querySelector("button")?.focus();
        }
      } catch (error) {
        if (destroyed) return;
        state = "retryable-error";
        feedback.textContent = error?.message || "\u63D0\u4EA4\u6682\u65F6\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002";
        buttons.forEach((button) => {
          button.disabled = true;
        });
        retryButton = make("button", "chunk-selection-retry", "\u91CD\u8BD5\u63D0\u4EA4");
        retryButton.type = "button";
        retryButton.onclick = () => {
          retryButton.remove();
          retryButton = null;
          state = "ready";
          submit();
        };
        selectedNode.append(retryButton);
      }
    }
    element.append(selectedNode, poolNode, feedback);
    render();
    element.getSelection = () => selected.map((id) => tokens.find((token) => String(token.id) === id));
    element.reset = () => {
      if (state === "pending") return;
      state = "ready";
      selected = [];
      feedback.textContent = "";
      selectedNode.removeAttribute("aria-invalid");
      render();
    };
    element.setState = (next) => {
      state = next;
      buttons.forEach((button) => {
        button.disabled = next === "pending" || next === "success" || next === "blocked";
      });
    };
  }
  element.getButton = (id) => buttons.get(String(id)) || null;
  element.setActive = (value) => {
    active = Boolean(value);
  };
  element.destroy = () => {
    if (destroyed) return;
    destroyed = true;
    active = false;
    buttons.forEach((button) => {
      button.disabled = true;
    });
    retryButton?.remove();
  };
  return element;
}

// src/expression-course/ui/renderers.mjs
var el = (tag, attrs = {}, text = "") => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) if (value !== void 0 && value !== null) node.setAttribute(key, value);
  if (text) node.textContent = text;
  return node;
};
function renderActivity(root, activity, { onAction, playAudio, preview = false } = {}) {
  root.replaceChildren();
  root.append(el("p", { class: "activity-prompt" }, activity.prompt || "\u5B8C\u6210\u8FD9\u4E00\u5C0F\u6B65"));
  const payload = activity.payload || {};
  let response = {};
  let submitting = false;
  if (activity.type === "meaning_intro" || activity.type === "micro_explanation") {
    const example = payload.exampleEnglish || payload.example || payload.explanation || "";
    const zh = payload.exampleZh || payload.meaning || payload.explanationZh || "";
    if (example) root.append(el("p", { class: "activity-example", lang: "en" }, example));
    if (zh) root.append(el("p", { class: "activity-meaning" }, zh));
  } else if (activity.type === "sentence_build") {
    root.append(el("p", { class: "activity-meaning" }, payload.targetMeaning || "\u6309\u6B63\u786E\u987A\u5E8F\u6392\u5217\u8BCD\u5757"));
    const targetCount = payload.expectedTokenCount || payload.availableTokens?.length || 0;
    const selection = createChunkSelection({
      mode: "sequence",
      className: "expression-chunk-selection",
      selectedClass: "token-row token-row-selected",
      poolClass: "token-row",
      buttonClass: "token-button",
      selectedButtonClass: "token-chip",
      targetCount,
      submitOnTarget: !preview && Boolean(onAction && payload.expectedTokenCount > 0),
      tokens: (payload.availableTokens || []).map((text, index) => ({
        id: `${activity.id || "activity"}:${index}`,
        text
      })),
      onSubmit: onAction && payload.expectedTokenCount > 0 ? (chosen) => {
        submitting = true;
        return Promise.resolve(onAction({ type: "submit", response: { tokens: chosen.map((token) => token.text) } })).finally(() => {
          submitting = false;
        });
      } : void 0
    });
    root.append(selection);
    response = { get tokens() {
      return selection.getSelection().map((token) => token.text);
    } };
  } else if (activity.type === "listening_choice") {
    const play = el("button", { type: "button", class: "button button-secondary" }, "\u64AD\u653E\u97F3\u9891");
    play.addEventListener("click", () => playAudio?.(payload.audioAssetId, play));
    root.append(play);
    if (!preview && onAction) {
      const skip = el("button", { type: "button", class: "text-button" }, "\u97F3\u9891\u65E0\u6CD5\u64AD\u653E\uFF1F\u8DF3\u8FC7\u672C\u9898");
      skip.addEventListener("click", () => onAction({ type: "skip_audio" }));
      root.append(skip);
    }
    const choices = el("div", { class: "choice-list", role: "group", "aria-label": "\u9009\u62E9\u542C\u5230\u7684\u610F\u601D" });
    for (const option of payload.options || []) {
      const button = el("button", { type: "button", class: "choice-button" }, option.textZh || option.text || "\u9009\u9879");
      button.addEventListener("click", () => {
        response.optionId = option.id;
        choices.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      });
      choices.append(button);
    }
    root.append(choices);
  } else {
    if (payload.scenario) root.append(el("p", { class: "activity-meaning" }, payload.scenario));
    if (payload.targetMeaning) root.append(el("p", { class: "activity-meaning" }, payload.targetMeaning));
    if (["substitution", "independent_output", "transfer_test"].includes(activity.type) && Number.isInteger(payload.expectedWordCount) && payload.expectedWordCount > 0) {
      const slots = el("div", { class: "word-slots", role: "group", "aria-label": "\u9010\u8BCD\u8F93\u5165\u82F1\u6587\u8868\u8FBE" });
      const inputs = Array.from({ length: payload.expectedWordCount }, (_, index) => {
        const input = el("input", {
          class: "word-slot",
          type: "text",
          maxlength: 32,
          autocomplete: "off",
          autocapitalize: "none",
          spellcheck: "false",
          "aria-label": `\u7B2C ${index + 1} \u4E2A\u5355\u8BCD`,
          "aria-posinset": String(index + 1),
          "aria-setsize": String(payload.expectedWordCount)
        });
        input.lang = "en";
        input.addEventListener("keydown", (event) => {
          if (event.key === " " && index < inputs.length - 1) {
            event.preventDefault();
            inputs[index + 1].focus();
          }
        });
        slots.append(input);
        return input;
      });
      response = { get text() {
        return inputs.map((input) => input.value.trim()).filter(Boolean).join(" ");
      } };
      root.append(slots);
    } else {
      const input = el("textarea", { class: "answer-input", rows: 2, maxlength: 500, placeholder: "\u5728\u8FD9\u91CC\u8F93\u5165\u4F60\u7684\u8868\u8FBE", "aria-label": "\u8F93\u5165\u82F1\u6587\u8868\u8FBE" });
      input.addEventListener("input", () => {
        response.text = input.value;
      });
      root.append(input);
    }
  }
  if (!preview && onAction) {
    const controls = el("div", { class: "activity-tools" });
    const hint = el("button", { type: "button", class: "text-button" }, "\u7ED9\u6211\u63D0\u793A");
    hint.addEventListener("click", () => {
      if (!submitting) onAction({ type: "hint" });
    });
    const reveal = el("button", { type: "button", class: "text-button" }, "\u663E\u793A\u7B54\u6848");
    reveal.addEventListener("click", () => {
      if (!submitting) onAction({ type: "reveal" });
    });
    if (!["meaning_intro", "micro_explanation"].includes(activity.type)) controls.append(hint, reveal);
    if (activity.type === "independent_output") {
      const skip = el("button", { type: "button", class: "text-button" }, "\u6682\u65F6\u8DF3\u8FC7");
      skip.addEventListener("click", () => onAction({ type: "skip_output" }));
      controls.append(skip);
    }
    root.append(controls);
  }
  return {
    response: () => response,
    informational: ["meaning_intro", "micro_explanation"].includes(activity.type),
    autoSubmit: activity.type === "sentence_build" && payload.expectedTokenCount > 0
  };
}

// src/expression-course/authoring/view.mjs
var $ = (id) => document.getElementById(id);
var requestId = () => crypto.randomUUID();
var draft = null;
var packageValue = null;
var uploadedFiles = /* @__PURE__ */ new Map();
var validation = null;
var workflowMode = null;
function adminToken() {
  try {
    return localStorage.getItem("chunklab_admin_token") || "";
  } catch (_) {
    return "";
  }
}
function adminBase() {
  try {
    return (localStorage.getItem("chunklab_api_base") || "").replace(/\/+$/, "");
  } catch (_) {
    return "";
  }
}
async function adminRequest(path, options = {}) {
  const headers = { ...options.headers || {} };
  if (adminToken()) headers.Authorization = "Bearer " + adminToken();
  if (options.body !== void 0) headers["Content-Type"] = "application/json";
  const response = await fetch(adminBase() + path, { method: options.method || "GET", headers, body: options.body, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || data.code || `\u8BF7\u6C42\u5931\u8D25 ${response.status}`);
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}
function message(text, isError = false) {
  const el2 = $("authorMessage");
  el2.textContent = text;
  el2.dataset.error = String(isError);
}
function showPackage(value) {
  packageValue = value;
  $("packageInput").value = JSON.stringify(value, null, 2);
}
function setStep(step, title, description) {
  const order = ["choose", "content", "audio", "check", "publish"];
  const current = order.indexOf(step);
  for (const item of $("workflowSteps").querySelectorAll("[data-step]")) {
    const index = order.indexOf(item.dataset.step);
    item.classList.toggle("is-complete", index < current);
    item.classList.toggle("is-current", index === current);
    if (index === current) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  }
  $("workflowTitle").textContent = title;
  $("workflowDescription").textContent = description;
}
function openWorkspace(value, { existingDraft = false } = {}) {
  const assets = Array.isArray(value?.assets) ? value.assets : [];
  const lessons = Array.isArray(value?.lessons) ? value.lessons : [];
  const missingAudio = assets.filter((asset) => !asset.sha256 || !asset.size).length;
  $("workflowChoice").hidden = true;
  $("aiPath").hidden = true;
  $("directImportPath").hidden = true;
  $("aiImportPath").hidden = true;
  $("changeWorkflow").hidden = true;
  $("packageWorkspace").hidden = false;
  $("packageEditor").open = false;
  $("packageHeading").textContent = value?.title || "\u8BFE\u7A0B\u5DF2\u8F7D\u5165";
  $("packageSummary").textContent = `\u5171 ${lessons.length} \u4E2A\u5355\u5143 \xB7 ${assets.length} \u4E2A\u97F3\u9891\u8D44\u6E90${missingAudio ? ` \xB7 \u8FD8\u6709 ${missingAudio} \u4E2A\u97F3\u9891\u5F85\u4E0A\u4F20` : " \xB7 \u97F3\u9891\u8D44\u6E90\u5DF2\u9F50"}`;
  $("audioStage").hidden = assets.length === 0;
  $("audioInstruction").textContent = missingAudio ? `\u8BF7\u9009\u62E9\u4E0E\u8BFE\u7A0B JSON \u4E2D localFile \u6587\u4EF6\u540D\u4E00\u81F4\u7684\u97F3\u9891\u6587\u4EF6\uFF1B\u8FD8\u9700\u4E0A\u4F20 ${missingAudio} \u4E2A\u3002\u4E5F\u53EF\u4EE5\u5148\u4FDD\u5B58\u8349\u7A3F\uFF0C\u7A0D\u540E\u8865\u9F50\u3002` : "\u5982\u9700\u8BD5\u542C\u793A\u8303\u97F3\u9891\uFF0C\u8BF7\u9009\u62E9\u4E0E\u8BFE\u7A0B JSON \u4E2D localFile \u6587\u4EF6\u540D\u4E00\u81F4\u7684\u6587\u4EF6\u3002";
  $("previewPackage").disabled = true;
  $("previewPackage").hidden = true;
  $("approvePackage").disabled = true;
  $("approvePackage").hidden = true;
  $("publishPackage").disabled = true;
  $("publishPackage").hidden = true;
  $("validationResult").textContent = "";
  $("preview").hidden = true;
  validation = null;
  if (assets.length && missingAudio) {
    setStep("audio", existingDraft ? "\u5F53\u524D\u6B65\u9AA4\uFF1A\u8865\u9F50\u8BFE\u7A0B\u97F3\u9891" : "\u5F53\u524D\u6B65\u9AA4\uFF1A\u4E0A\u4F20\u914D\u5957\u97F3\u9891", "\u97F3\u9891\u6587\u4EF6\u540D\u9700\u8981\u4E0E\u8BFE\u7A0B JSON \u4E2D\u5217\u51FA\u7684\u6587\u4EF6\u540D\u4E00\u81F4\u3002\u4E0A\u4F20\u540E\u518D\u68C0\u67E5\u8BFE\u7A0B\u3002");
  } else {
    setStep("check", existingDraft ? "\u5F53\u524D\u6B65\u9AA4\uFF1A\u91CD\u65B0\u68C0\u67E5\u8349\u7A3F" : "\u5F53\u524D\u6B65\u9AA4\uFF1A\u68C0\u67E5\u8BFE\u7A0B\u5185\u5BB9", "\u68C0\u67E5\u4F1A\u81EA\u52A8\u4FDD\u5B58\u8349\u7A3F\uFF0C\u5E76\u6838\u5BF9\u8BFE\u7A0B\u7ED3\u6784\u548C\u97F3\u9891\u8D44\u6E90\u3002\u901A\u8FC7\u540E\u53EF\u4EE5\u8BD5\u542C\u5E76\u786E\u8BA4\u3002");
  }
}
function invalidateCheck() {
  validation = null;
  $("validationResult").textContent = "";
  $("previewPackage").disabled = true;
  $("previewPackage").hidden = true;
  $("approvePackage").disabled = true;
  $("approvePackage").hidden = true;
  $("publishPackage").disabled = true;
  $("publishPackage").hidden = true;
  if (!$("packageWorkspace").hidden) setStep("check", "\u5F53\u524D\u6B65\u9AA4\uFF1A\u91CD\u65B0\u68C0\u67E5\u8BFE\u7A0B", "\u8BFE\u7A0B\u5185\u5BB9\u6709\u53D8\u5316\uFF1B\u8BF7\u91CD\u65B0\u68C0\u67E5\u3002\u68C0\u67E5\u4F1A\u81EA\u52A8\u4FDD\u5B58\u8349\u7A3F\u3002");
}
function readPackage() {
  try {
    packageValue = JSON.parse($("packageInput").value);
    if (!packageValue || typeof packageValue !== "object") throw new Error();
    return packageValue;
  } catch {
    throw new Error("JSON \u683C\u5F0F\u4E0D\u6B63\u786E\uFF0C\u8BF7\u68C0\u67E5\u540E\u518D\u7EE7\u7EED\u3002");
  }
}
async function saveDraft() {
  const pkg = readPackage();
  if (draft) draft = await adminRequest("/api/admin/expression-drafts/" + encodeURIComponent(draft.draftId), { method: "PUT", body: JSON.stringify({ expectedRevision: draft.revision, requestId: requestId(), package: pkg }) });
  else draft = await adminRequest("/api/admin/expression-drafts", { method: "POST", body: JSON.stringify({ requestId: requestId(), package: pkg }) });
  validation = null;
  return draft;
}
async function refreshDrafts() {
  const result = await adminRequest("/api/admin/expression-drafts");
  const list = $("draftList");
  list.replaceChildren();
  for (const item of result.drafts) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "draft-link";
    button.textContent = `${item.title || "\u672A\u547D\u540D\u8BFE\u7A0B"} \xB7 \u4FEE\u8BA2 ${item.revision}`;
    button.onclick = async () => {
      draft = await adminRequest("/api/admin/expression-drafts/" + encodeURIComponent(item.draftId));
      showPackage(draft.package);
      openWorkspace(draft.package, { existingDraft: true });
      message("\u5DF2\u6253\u5F00\u8349\u7A3F\u3002\u6309\u5F53\u524D\u6B65\u9AA4\u7EE7\u7EED\uFF1B\u4FEE\u6539\u540E\u9700\u8981\u91CD\u65B0\u68C0\u67E5\u548C\u5BA1\u6838\u3002");
    };
    list.append(button);
  }
  if (!result.drafts.length) list.textContent = "\u8FD8\u6CA1\u6709\u4FDD\u5B58\u7684\u8349\u7A3F\u3002";
  const published = await adminRequest("/api/admin/expression-courses");
  const publishedList = $("publishedList");
  publishedList.replaceChildren();
  for (const course of published.courses) {
    const row = document.createElement("div");
    row.className = "published-row";
    const title = document.createElement("span");
    title.textContent = `${course.title} \xB7 ${course.status === "active" ? "\u5DF2\u4E0A\u67B6" : "\u5DF2\u4E0B\u67B6"} \xB7 ${course.releaseId || "\u65E0\u7248\u672C"}`;
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "button button-secondary";
    copy.textContent = "\u590D\u5236\u4E3A\u65B0\u8349\u7A3F";
    copy.onclick = async () => {
      try {
        const result2 = await adminRequest("/api/admin/expression-drafts", { method: "POST", body: JSON.stringify({ requestId: requestId(), package: course.package }) });
        draft = await adminRequest("/api/admin/expression-drafts/" + encodeURIComponent(result2.draftId));
        showPackage(draft.package);
        openWorkspace(draft.package, { existingDraft: true });
        message("\u5DF2\u590D\u5236\u4E3A\u65B0\u8349\u7A3F\uFF1B\u539F\u53D1\u5E03\u7248\u672C\u4E0D\u4F1A\u88AB\u6539\u52A8\u3002");
        await refreshDrafts();
      } catch (error) {
        message(error.message, true);
      }
    };
    row.append(title, copy);
    if (course.status === "active") {
      const unlist = document.createElement("button");
      unlist.type = "button";
      unlist.className = "button button-danger";
      unlist.textContent = "\u4E0B\u67B6";
      unlist.onclick = async () => {
        try {
          await adminRequest("/api/admin/expression-courses/" + encodeURIComponent(course.courseId) + "/unlist", { method: "POST", body: JSON.stringify({ requestId: requestId() }) });
          await refreshDrafts();
          message("\u8BFE\u7A0B\u5DF2\u4ECE\u53D1\u73B0\u76EE\u5F55\u4E0B\u67B6\uFF1B\u5386\u53F2\u7248\u672C\u548C\u5B66\u4E60\u8BB0\u5F55\u4FDD\u7559\u3002");
        } catch (error) {
          message(error.message, true);
        }
      };
      row.append(unlist);
    }
    publishedList.append(row);
  }
  if (!published.courses.length) publishedList.textContent = "\u8FD8\u6CA1\u6709\u53D1\u5E03\u7684\u8BFE\u7A0B\u3002";
}
async function chooseFiles(files) {
  const pkg = readPackage();
  const descriptors = new Map((pkg.assets || []).map((asset) => [asset.localFile.split("/").pop(), asset]));
  for (const file of files) {
    const asset = descriptors.get(file.name);
    if (!asset) throw new Error(`\u627E\u4E0D\u5230\u4E0E\u6587\u4EF6 ${file.name} \u5BF9\u5E94\u7684 localFile\u3002\u6587\u4EF6\u540D\u8BF7\u4E0E JSON \u4E00\u81F4\u3002`);
    if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} \u8D85\u8FC7 5 MiB\u3002`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const uploaded = await adminRequest("/api/admin/expression-assets", { method: "POST", body: JSON.stringify({ assetId: asset.assetId, mimeType: file.type, base64: btoa(binary) }) });
    asset.sha256 = uploaded.sha256;
    asset.size = uploaded.size;
    uploadedFiles.set(asset.assetId, file);
  }
  showPackage(pkg);
  const missingAudio = (pkg.assets || []).filter((asset) => !asset.sha256 || !asset.size).length;
  setStep("check", "\u5F53\u524D\u6B65\u9AA4\uFF1A\u68C0\u67E5\u8BFE\u7A0B\u5185\u5BB9", missingAudio ? `\u5DF2\u4E0A\u4F20 ${files.length} \u4E2A\u97F3\u9891\uFF1B\u8FD8\u6709 ${missingAudio} \u4E2A\u5F85\u4E0A\u4F20\u3002\u4E5F\u53EF\u4EE5\u5148\u68C0\u67E5\uFF0C\u7CFB\u7EDF\u4F1A\u6307\u51FA\u7F3A\u5C11\u9879\u3002` : "\u97F3\u9891\u5DF2\u4E0A\u4F20\u3002\u4E0B\u4E00\u6B65\u68C0\u67E5\u4F1A\u81EA\u52A8\u4FDD\u5B58\u8349\u7A3F\uFF0C\u5E76\u6838\u5BF9\u8BFE\u7A0B\u7ED3\u6784\u548C\u8D44\u6E90\u3002");
  message(`\u5DF2\u4E0A\u4F20\u5E76\u6821\u9A8C ${files.length} \u4E2A\u97F3\u9891\u6587\u4EF6\u3002\u4E0B\u4E00\u6B65\uFF1A\u68C0\u67E5\u8BFE\u7A0B\u3002`);
}
async function validate() {
  await saveDraft();
  validation = await adminRequest(`/api/admin/expression-drafts/${encodeURIComponent(draft.draftId)}/validate`, { method: "POST", body: "{}" });
  $("validationResult").textContent = validation.valid ? `\u6821\u9A8C\u901A\u8FC7 \xB7 \u5185\u5BB9\u6458\u8981 ${validation.contentHash}` : validation.errors.join("\n");
  if (validation.valid) {
    $("previewPackage").disabled = false;
    $("previewPackage").hidden = false;
    $("approvePackage").disabled = false;
    $("approvePackage").hidden = false;
    setStep("publish", "\u5F53\u524D\u6B65\u9AA4\uFF1A\u8BD5\u542C\u5E76\u786E\u8BA4\u8BFE\u7A0B", "\u68C0\u67E5\u5DF2\u901A\u8FC7\u3002\u53EF\u4EE5\u5148\u8BD5\u542C\u7B2C\u4E00\u6B65\uFF0C\u518D\u786E\u8BA4\u5185\u5BB9\uFF1B\u786E\u8BA4\u540E\u624D\u4F1A\u5F00\u653E\u53D1\u5E03\u3002");
  } else {
    $("previewPackage").disabled = true;
    $("previewPackage").hidden = true;
    $("approvePackage").disabled = true;
    $("approvePackage").hidden = true;
    $("publishPackage").disabled = true;
    $("publishPackage").hidden = true;
    setStep("check", "\u5F53\u524D\u6B65\u9AA4\uFF1A\u4FEE\u6B63\u68C0\u67E5\u95EE\u9898", "\u8BF7\u6309\u4E0B\u65B9\u68C0\u67E5\u7ED3\u679C\u4FEE\u6B63\u8BFE\u7A0B\u6216\u8865\u9F50\u8D44\u6E90\uFF0C\u7136\u540E\u91CD\u65B0\u68C0\u67E5\u3002");
  }
  message(validation.valid ? "\u68C0\u67E5\u901A\u8FC7\u5E76\u5DF2\u4FDD\u5B58\u8349\u7A3F\u3002\u8BD5\u542C\u4E3A\u53EF\u9009\uFF1B\u786E\u8BA4\u5185\u5BB9\u540E\u624D\u80FD\u53D1\u5E03\u3002" : "\u53D1\u73B0\u9700\u8981\u4FEE\u6B63\u7684\u95EE\u9898\uFF0C\u8BF7\u6309\u68C0\u67E5\u7ED3\u679C\u5904\u7406\u540E\u91CD\u65B0\u68C0\u67E5\u3002", !validation.valid);
  return validation;
}
async function run() {
  if (!adminToken()) $("adminLogin").hidden = false;
  try {
    if (adminToken()) await refreshDrafts();
    else message("\u8BF7\u767B\u5F55\u7BA1\u7406\u5458\u8D26\u53F7\u540E\u7BA1\u7406\u8BFE\u7A0B\u3002");
  } catch (error) {
    $("adminLogin").hidden = false;
    message(error.message || "\u5F53\u524D\u8D26\u53F7\u6CA1\u6709\u5236\u4F5C\u6743\u9650\u3002", true);
  }
  $("adminLogin").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await adminRequest("/api/admin/login", { method: "POST", body: JSON.stringify({ password: $("adminPassword").value }) });
      localStorage.setItem("chunklab_admin_token", result.token);
      $("adminLogin").hidden = true;
      await refreshDrafts();
      message("\u7BA1\u7406\u5458\u5DF2\u767B\u5F55\u3002");
    } catch (error) {
      message(error.message, true);
    }
  });
  $("packageInput").addEventListener("input", invalidateCheck);
  $("workflowChoice").querySelectorAll("[data-mode]").forEach((button) => {
    button.onclick = () => {
      workflowMode = button.dataset.mode;
      $("workflowChoice").hidden = true;
      $("aiPath").hidden = workflowMode !== "ai";
      $("directImportPath").hidden = workflowMode !== "import";
      $("aiImportPath").hidden = true;
      $("changeWorkflow").hidden = false;
      setStep("content", workflowMode === "ai" ? "\u5F53\u524D\u6B65\u9AA4\uFF1A\u5230\u5916\u90E8 AI \u5236\u4F5C\u8BFE\u7A0B" : "\u5F53\u524D\u6B65\u9AA4\uFF1A\u5BFC\u5165\u8BFE\u7A0B JSON", workflowMode === "ai" ? "\u590D\u5236\u6307\u4EE4\u5E76\u5728\u5916\u90E8 AI \u5BF9\u8BDD\u4E2D\u5B8C\u6210\u8BFE\u7A0B\uFF1B\u62FF\u5230 JSON \u540E\u56DE\u5230\u8FD9\u91CC\u5BFC\u5165\u3002" : "\u9009\u62E9\u5DF2\u6709\u7684\u5B8C\u6574\u8BFE\u7A0B JSON \u6587\u4EF6\uFF0C\u5BFC\u5165\u540E\u6309\u63D0\u793A\u68C0\u67E5\u8D44\u6E90\u3002");
    };
  });
  $("changeWorkflow").onclick = () => {
    workflowMode = null;
    $("workflowChoice").hidden = false;
    $("aiPath").hidden = true;
    $("directImportPath").hidden = true;
    $("aiImportPath").hidden = true;
    $("changeWorkflow").hidden = true;
    setStep("choose", "\u5F53\u524D\u6B65\u9AA4\uFF1A\u9009\u62E9\u4E00\u79CD\u5F00\u59CB\u65B9\u5F0F", "\u5DF2\u6709\u5B8C\u6574\u8BFE\u7A0B JSON \u5C31\u76F4\u63A5\u5BFC\u5165\uFF1B\u8FD8\u6CA1\u6709\u8BFE\u7A0B\u5305\uFF0C\u5C31\u5148\u7528\u5916\u90E8 AI \u5236\u4F5C\u3002");
  };
  $("copyPrompt").onclick = async () => {
    try {
      await navigator.clipboard.writeText(makeExpressionCoursePrompt());
      $("aiImportNext").hidden = false;
      setStep("content", "\u5F53\u524D\u6B65\u9AA4\uFF1A\u5728\u5916\u90E8 AI \u5B8C\u6210\u8BFE\u7A0B", "\u5236\u4F5C\u6307\u4EE4\u5DF2\u590D\u5236\u3002\u5C06\u6559\u6750\u6216\u8D44\u6599\u53D1\u9001\u7ED9\u6240\u9009 AI\uFF0C\u786E\u8BA4\u751F\u6210\u7684 JSON \u540E\u518D\u56DE\u5230\u8FD9\u91CC\u5BFC\u5165\u3002");
      message("\u5236\u4F5C\u6307\u4EE4\u5DF2\u590D\u5236\u3002\u5B8C\u6210\u5916\u90E8 AI \u5BF9\u8BDD\u540E\uFF0C\u70B9\u51FB\u201C\u6211\u5DF2\u62FF\u5230 JSON\uFF0C\u7EE7\u7EED\u5BFC\u5165\u201D\u3002");
    } catch (error) {
      message("\u65E0\u6CD5\u81EA\u52A8\u590D\u5236\u3002\u8BF7\u68C0\u67E5\u6D4F\u89C8\u5668\u526A\u8D34\u677F\u6743\u9650\u540E\u91CD\u8BD5\u3002", true);
    }
  };
  $("continueAIImport").onclick = () => {
    $("aiPath").hidden = true;
    $("aiImportPath").hidden = false;
    setStep("content", "\u5F53\u524D\u6B65\u9AA4\uFF1A\u5BFC\u5165 AI \u751F\u6210\u7684\u8BFE\u7A0B", "\u9009\u62E9\u5916\u90E8 AI \u8FD4\u56DE\u7684\u5B8C\u6574\u8BFE\u7A0B JSON \u6587\u4EF6\u3002\u5BFC\u5165\u540E\u4F1A\u663E\u793A\u97F3\u9891\u548C\u68C0\u67E5\u6B65\u9AA4\u3002");
  };
  const importPackage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const value = JSON.parse(await file.text());
      if (!value || typeof value !== "object" || !Array.isArray(value.lessons)) throw new Error("\u6587\u4EF6\u4E0D\u662F\u5B8C\u6574\u7684\u8BFE\u7A0B JSON\u3002");
      draft = null;
      uploadedFiles = /* @__PURE__ */ new Map();
      showPackage(value);
      openWorkspace(value);
      message("\u8BFE\u7A0B JSON \u5DF2\u5BFC\u5165\u3002\u8BF7\u6309\u5F53\u524D\u6B65\u9AA4\u7EE7\u7EED\u3002");
    } catch (error) {
      message(error.message || "\u65E0\u6CD5\u8BFB\u53D6\u8BFE\u7A0B JSON \u6587\u4EF6\u3002", true);
    }
    event.target.value = "";
  };
  $("importPackage").onchange = importPackage;
  $("importPackageAfterAI").onchange = importPackage;
  $("uploadAudio").onchange = async (event) => {
    try {
      await chooseFiles(event.target.files);
    } catch (error) {
      message(error.message, true);
    }
    event.target.value = "";
  };
  $("saveDraft").onclick = async () => {
    try {
      await saveDraft();
      await refreshDrafts();
      message("\u8349\u7A3F\u5DF2\u4FDD\u5B58\u3002\u5B83\u4ECD\u662F\u79C1\u6709\u8349\u7A3F\uFF0C\u4E0D\u4F1A\u51FA\u73B0\u5728\u8BFE\u7A0B\u76EE\u5F55\u3002");
    } catch (error) {
      message(error.message, true);
    }
  };
  $("checkPackage").onclick = async () => {
    try {
      await validate();
    } catch (error) {
      message(error.message, true);
    }
  };
  $("previewPackage").onclick = () => {
    try {
      const pkg = readPackage();
      const activity = pkg.lessons?.[0]?.activities?.[0];
      if (!activity) throw new Error("\u6CA1\u6709\u53EF\u9884\u89C8\u7684\u8BFE\u7A0B\u6D3B\u52A8\u3002");
      $("preview").hidden = false;
      $("previewTitle").textContent = pkg.title || "\u8BFE\u7A0B\u9884\u89C8";
      renderActivity($("previewBody"), activity, { preview: true, playAudio: (id) => {
        const file = uploadedFiles.get(id);
        if (!file) return message("\u8BF7\u5148\u9009\u62E9\u672C\u5730\u97F3\u9891\u6587\u4EF6\u624D\u80FD\u8BD5\u542C\u3002", true);
        const audio = new Audio(URL.createObjectURL(file));
        audio.play();
      } });
    } catch (error) {
      message(error.message, true);
    }
  };
  $("approvePackage").onclick = async () => {
    try {
      const checked = validation || await validate();
      if (!checked.valid) return;
      await adminRequest(`/api/admin/expression-drafts/${encodeURIComponent(draft.draftId)}/review`, { method: "POST", body: JSON.stringify({ contentHash: checked.contentHash }) });
      message("\u5185\u5BB9\u786E\u8BA4\u5B8C\u6210\uFF0C\u53D1\u5E03\u6309\u94AE\u5DF2\u5F00\u653E\u3002");
      $("publishPackage").disabled = false;
      $("publishPackage").hidden = false;
      setStep("publish", "\u5F53\u524D\u6B65\u9AA4\uFF1A\u53D1\u5E03\u5230\u7CFB\u7EDF\u8BFE\u7A0B\u76EE\u5F55", "\u5185\u5BB9\u5DF2\u786E\u8BA4\u3002\u70B9\u51FB\u53D1\u5E03\u540E\uFF0C\u8BFE\u7A0B\u5C06\u5BF9\u6240\u6709\u7528\u6237\u53EF\u89C1\uFF0C\u4E0D\u4F1A\u81EA\u52A8\u52A0\u5165\u4EFB\u4F55\u8D26\u53F7\u3002");
    } catch (error) {
      message(error.message, true);
    }
  };
  $("publishPackage").onclick = async () => {
    try {
      const checked = validation || await validate();
      const result = await adminRequest(`/api/admin/expression-drafts/${encodeURIComponent(draft.draftId)}/publish`, { method: "POST", body: JSON.stringify({ expectedRevision: draft.revision, contentHash: checked.contentHash, requestId: requestId() }) });
      message(`\u5DF2\u53D1\u5E03\u5230\u7CFB\u7EDF\u8BFE\u7A0B\u76EE\u5F55\uFF1A${result.courseId} \xB7 ${result.releaseId}\u3002\u6CA1\u6709\u66FF\u4EFB\u4F55\u8D26\u53F7\u62A5\u540D\u3002`);
      await refreshDrafts();
    } catch (error) {
      message(error.message, true);
    }
  };
  $("deleteDraft").onclick = async () => {
    if (!draft) return message("\u5148\u4ECE\u8349\u7A3F\u5217\u8868\u9009\u62E9\u4E00\u9879\u3002", true);
    if (!confirm("\u786E\u5B9A\u5220\u9664\u8FD9\u4EFD\u672A\u53D1\u5E03\u8349\u7A3F\uFF1F")) return;
    try {
      await adminRequest(`/api/admin/expression-drafts/${encodeURIComponent(draft.draftId)}`, { method: "DELETE", body: JSON.stringify({ expectedRevision: draft.revision, requestId: requestId() }) });
      draft = null;
      showPackage({});
      $("packageWorkspace").hidden = true;
      $("workflowChoice").hidden = false;
      $("changeWorkflow").hidden = true;
      await refreshDrafts();
      message("\u8349\u7A3F\u5DF2\u5220\u9664\u3002");
    } catch (error) {
      message(error.message, true);
    }
  };
}
run();
