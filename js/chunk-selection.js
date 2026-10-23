var ChunkSelection = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/shared/chunk-selection.mjs
  var chunk_selection_exports = {};
  __export(chunk_selection_exports, {
    createChunkSelection: () => createChunkSelection
  });
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
  return __toCommonJS(chunk_selection_exports);
})();
