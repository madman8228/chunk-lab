var ChunkMembership = (() => {
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

  // scripts/membership-browser-entry.mjs
  var membership_browser_entry_exports = {};
  __export(membership_browser_entry_exports, {
    CourseImageCache: () => CourseImageCache,
    CoursePolicyView: () => CoursePolicyView,
    CoursePublicationView: () => CoursePublicationView,
    LearningSessionController: () => LearningSessionController,
    MembershipClient: () => MembershipClient,
    buildProtectedHistoryDecks: () => buildProtectedHistoryDecks,
    imageCacheScope: () => imageCacheScope,
    mountNativeAssessment: () => mountNativeAssessment,
    mountNativeCourse: () => mountNativeCourse
  });

  // src/membership/admin-policy-view.mjs
  var CoursePolicyView = class {
    constructor({ root, request, newRequestId }) {
      this.root = root;
      this.request = request;
      this.newRequestId = newRequestId;
      this.snapshot = null;
      this.pending = null;
      this.busy = false;
      root.querySelector("[data-policy-refresh]").addEventListener("click", () => this.load());
      root.querySelector("[data-policy-preview]").addEventListener("click", () => this.preview());
      root.querySelector("[data-policy-publish]").addEventListener("click", () => this.publish());
      root.querySelector("[data-policy-rows]").addEventListener("change", () => this.invalidate());
    }
    status(text) {
      this.root.querySelector("[data-policy-status]").textContent = text;
    }
    setBusy(busy) {
      this.busy = busy;
      for (const selector of ["[data-policy-refresh]", "[data-policy-preview]", "[data-policy-rows] select", "[data-policy-source]"]) {
        for (const control of this.root.querySelectorAll(selector)) control.disabled = busy;
      }
      this.root.querySelector("[data-policy-publish]").disabled = busy || !this.pending;
    }
    invalidate() {
      this.pending = null;
      this.root.querySelector("[data-policy-publish]").disabled = true;
      this.status("\u4FEE\u6539\u540E\u8BF7\u5148\u68C0\u67E5\u5F71\u54CD\uFF0C\u518D\u53D1\u5E03\u3002");
    }
    async load() {
      if (this.busy) return false;
      this.pending = null;
      this.setBusy(true);
      try {
        const snapshot = await this.request("/api/admin/membership/course-access");
        this.snapshot = snapshot;
        this.pending = null;
        this.root.querySelector("[data-policy-publish]").disabled = true;
        const rows = this.root.querySelector("[data-policy-rows]");
        rows.replaceChildren();
        for (const course of snapshot.courses) {
          const row = document.createElement("tr");
          row.dataset.courseId = course.courseId;
          const name = document.createElement("td");
          name.textContent = course.title;
          const protection = document.createElement("td");
          protection.textContent = course.protectionReady ? "\u5DF2\u63A5\u5165\u53D7\u4FDD\u62A4\u8BFB\u53D6" : "\u5C1A\u672A\u5B8C\u6210\u5185\u5BB9\u4FDD\u62A4";
          if (!course.protectionReady) {
            const inspect = document.createElement("button");
            inspect.type = "button";
            inspect.className = "btn secondary";
            inspect.dataset.policySource = course.courseId;
            inspect.textContent = "\u68C0\u67E5\u8BFE\u7A0B\u6765\u6E90";
            inspect.setAttribute("aria-label", "\u68C0\u67E5 " + course.title + " \u7684\u6765\u6E90");
            inspect.onclick = () => this.inspectSources(course);
            protection.append(" ", inspect);
          }
          const choice = document.createElement("td");
          const select = document.createElement("select");
          select.className = "field";
          select.setAttribute("aria-label", course.title + "\u8BBF\u95EE\u7EA7\u522B");
          for (const [value, label] of [["free", "\u514D\u8D39\u8BFE\u7A0B"], ["member", "\u4F1A\u5458\u8BFE\u7A0B"]]) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            option.disabled = value === "member" && !course.protectionReady;
            select.appendChild(option);
          }
          select.value = course.accessLevel;
          choice.appendChild(select);
          row.append(name, protection, choice);
          rows.appendChild(row);
        }
        this.status(snapshot.courses.length ? "\u9009\u62E9\u8BBF\u95EE\u7EA7\u522B\u540E\uFF0C\u5148\u68C0\u67E5\u662F\u5426\u5F71\u54CD\u5171\u4EAB\u8BFE\u7A0B\u3002" : "\u6682\u65E0\u5E73\u53F0\u8BFE\u7A0B\u3002");
        return true;
      } catch (error) {
        this.snapshot = null;
        this.status(error.message || "\u8BFE\u7A0B\u7B56\u7565\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6\u3002");
        return false;
      } finally {
        this.setBusy(false);
      }
    }
    changes() {
      return this.snapshot.courses.flatMap((course) => {
        const row = [...this.root.querySelectorAll("[data-course-id]")].find((item) => item.dataset.courseId === course.courseId);
        const accessLevel = row.querySelector("select").value;
        return accessLevel === course.accessLevel ? [] : [{ courseId: course.courseId, baseRevision: course.revision, accessLevel }];
      });
    }
    async inspectSources(course) {
      if (this.busy) return;
      this.setBusy(true);
      this.status("\u6B63\u5728\u53EA\u8BFB\u68C0\u67E5\u8BFE\u7A0B\u6765\u6E90\u2026");
      const panel = this.root.querySelector("[data-policy-source-review]");
      try {
        const report = await this.request("/api/admin/membership/course-source-review", { method: "POST", body: JSON.stringify({ courseIds: [course.courseId] }) });
        if (panel) {
          const text = (tag, value) => {
            const element2 = document.createElement(tag);
            element2.textContent = value;
            return element2;
          };
          const files = document.createElement("details"), list = document.createElement("ul");
          files.append(text("summary", "\u67E5\u770B\u6765\u6E90\u6587\u4EF6\uFF08" + report.sourcePaths.length + " \u4E2A\uFF09"));
          report.sourcePaths.forEach((file) => list.append(text("li", file)));
          files.append(list);
          const conflicts = document.createElement("ul");
          report.sharedCourses.forEach((row) => conflicts.append(text("li", "\u5171\u4EAB\u8BFE\u7A0B\uFF1A" + row.title + "\uFF08" + row.courseId + "\uFF09")));
          report.publicShareConflicts.forEach((row) => conflicts.append(text("li", "\u516C\u5F00\u5206\u4EAB\u9898\u5E93\uFF1A" + row.deckId)));
          panel.replaceChildren(
            text("h3", course.title + " \xB7 \u6765\u6E90\u68C0\u67E5\u62A5\u544A"),
            text("p", "\u672C\u5730\u68C0\u67E5\u5B8C\u6210\uFF1A" + report.unitCount + " \u4E2A\u8BFE\u8282\uFF0C" + report.itemCount + " \u9879\u5185\u5BB9\u3002\u5C1A\u672A\u542F\u7528\u5185\u5BB9\u4FDD\u62A4\uFF0C\u8BBF\u95EE\u7EA7\u522B\u4FDD\u6301\u539F\u6837\u3002"),
            text("p", "\u5171\u4EAB\u8BFE\u7A0B " + report.sharedCourses.length + " \u95E8\uFF1B\u516C\u5F00\u5206\u4EAB\u51B2\u7A81 " + report.publicShareConflicts.length + " \u4E2A\u3002"),
            conflicts,
            text("p", "\u672A\u68C0\u67E5\u7684\u516C\u5F00\u538B\u7F29\u5305/\u6587\u6863 " + report.uninspectedArtifacts.length + " \u4E2A\u3002\u542F\u7528\u524D\u8FD8\u9700\u6838\u5BF9\u7F16\u7801\u526F\u672C\u3001\u539F\u5B66\u4E60\u8BB0\u5F55\u4E0E\u8BFE\u7A0B\u5165\u53E3\uFF0C\u4EE5\u53CA\u6B63\u5F0F\u670D\u52A1\u5668\u7684\u6587\u4EF6\u51FA\u53E3\u3002\u6B64\u524D\u5DF2\u516C\u5F00\u7684\u526F\u672C\u65E0\u6CD5\u6536\u56DE\u3002"),
            files
          );
          panel.hidden = false;
        }
        this.status("\u6765\u6E90\u62A5\u544A\u5DF2\u751F\u6210\uFF1B\u5B8C\u6210\u542F\u7528\u68C0\u67E5\u524D\uFF0C\u4F1A\u5458\u8BFE\u7A0B\u9009\u9879\u4ECD\u4E0D\u53EF\u7528\u3002");
      } catch (error) {
        this.status(error.message || "\u6765\u6E90\u68C0\u67E5\u6682\u4E0D\u53EF\u7528\uFF0C\u539F\u8BFE\u7A0B\u4FDD\u6301\u539F\u6837\u3002");
      } finally {
        this.setBusy(false);
      }
    }
    async preview() {
      if (!this.snapshot || this.busy) return;
      const changes = this.changes();
      if (!changes.length) {
        this.status("\u5C1A\u672A\u4FEE\u6539\u8BBF\u95EE\u7EA7\u522B\u3002");
        return;
      }
      this.pending = null;
      this.setBusy(true);
      try {
        const result = await this.request("/api/admin/membership/course-access/preview", {
          method: "POST",
          body: JSON.stringify({ changes, registryVersion: this.snapshot.version })
        });
        if (result.allowed) {
          this.pending = { changes, registryVersion: this.snapshot.version, requestId: this.newRequestId(), reason: "\u7BA1\u7406\u5458\u8BFE\u7A0B\u8BBF\u95EE\u8BBE\u7F6E" };
          this.root.querySelector("[data-policy-publish]").disabled = false;
          this.status("\u68C0\u67E5\u901A\u8FC7\uFF0C\u5C06\u4FEE\u6539 " + changes.length + " \u95E8\u8BFE\u7A0B\u3002\u5DF2\u516C\u5F00\u6216\u4E0B\u8F7D\u7684\u526F\u672C\u65E0\u6CD5\u8FFD\u6EAF\u6536\u56DE\u3002");
        } else {
          this.status("\u65E0\u6CD5\u53D1\u5E03\uFF1A\u5171\u4EAB\u5185\u5BB9\u4ECD\u53EF\u7531\u514D\u8D39\u8BFE\u7A0B\u6216\u516C\u5F00\u9898\u5E93\u8BFB\u53D6\u3002\u51B2\u7A81\uFF1A" + result.conflicts.map((row) => row.conflictingCourseId || row.publicDeckId).join("\u3001"));
        }
      } catch (error) {
        this.status(error.message || "\u68C0\u67E5\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002");
      } finally {
        this.setBusy(false);
      }
    }
    async publish() {
      if (!this.pending || this.busy) return;
      const pending2 = this.pending;
      this.setBusy(true);
      try {
        await this.request("/api/admin/membership/course-access", { method: "PUT", body: JSON.stringify(pending2) });
        this.pending = null;
        this.setBusy(false);
        const loaded = await this.load();
        this.status(loaded ? "\u8BFE\u7A0B\u8BBF\u95EE\u7EA7\u522B\u5DF2\u66F4\u65B0\u3002" : "\u53D1\u5E03\u5DF2\u6210\u529F\uFF0C\u4F46\u5217\u8868\u5237\u65B0\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u5237\u65B0\u3002");
      } catch (error) {
        this.status(error.message || "\u53D1\u5E03\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\uFF1B\u76F8\u540C\u8BF7\u6C42\u4E0D\u4F1A\u91CD\u590D\u5E94\u7528\u3002");
      } finally {
        this.setBusy(false);
      }
    }
  };

  // src/membership/client.mjs
  var MembershipClient = class {
    constructor({ request, readCatalog = null }) {
      this.request = request;
      this.readCatalog = readCatalog;
    }
    catalog() {
      return this.readCatalog ? this.readCatalog() : this.request("/api/course-content/catalog", { timeoutMs: 8e3 });
    }
    start(input) {
      return this.request("/api/learning-sessions/start", { method: "POST", body: JSON.stringify(input), timeoutMs: 8e3 });
    }
    startAssessment(input) {
      return this.request("/api/protected-assessments/start", { method: "POST", body: JSON.stringify(input), timeoutMs: 8e3 });
    }
    contentGrant(input) {
      return this.request("/api/learning-sessions/content-grant", { method: "POST", body: JSON.stringify(input), timeoutMs: 8e3 });
    }
    action(sessionId, sequence, action) {
      return this.request(
        "/api/learning-sessions/" + encodeURIComponent(sessionId) + "/" + action,
        { method: "POST", body: JSON.stringify({ sequence }), timeoutMs: 8e3 }
      );
    }
    read(courseId, unitId, cursor, sessionId) {
      return this.request(
        "/api/course-content/" + encodeURIComponent(courseId) + "/units/" + encodeURIComponent(unitId) + "?cursor=" + cursor,
        { headers: sessionId ? { "X-Learning-Session": sessionId } : {}, timeoutMs: 8e3 }
      );
    }
  };

  // src/membership/learning-session-controller.mjs
  var failure = (code) => Object.assign(new Error(code), { code });
  var LearningSessionController = class {
    /** @param {{client:any,newRequestId:()=>string,monotonicNow?:()=>number,captureScope?:()=>any,onState?:(state:any)=>void,setTimer?:(callback:()=>void,delay:number)=>any,clearTimer?:(id:any)=>void}} options */
    constructor({
      client,
      newRequestId,
      monotonicNow = () => performance.now(),
      captureScope = () => "",
      onState = (state) => {
        void state;
      },
      setTimer = (callback, delay) => globalThis.setTimeout(callback, delay),
      clearTimer = (id) => globalThis.clearTimeout(id)
    }) {
      this.client = client;
      this.newRequestId = newRequestId;
      this.now = monotonicNow;
      this.captureScope = captureScope;
      this.onState = onState;
      this.setTimer = setTimer;
      this.clearTimer = clearTimer;
      this.scope = captureScope();
      this.epoch = 0;
      this.current = null;
      this.pendingStart = null;
      this.pendingAction = null;
      this.busy = false;
      this.visible = true;
      this.requestedPause = false;
      this.phase = "idle";
      this.heartbeatTimer = null;
      this.deadlineTimer = null;
    }
    emit(reasonCode = null) {
      this.onState({
        phase: this.phase,
        reasonCode,
        mode: this.current?.mode,
        remainingDeadline: this.current?.remainingDeadline,
        remainingSeconds: this.current?.remainingSeconds,
        nextResetAt: this.current?.nextResetAt,
        canAdvance: this.canAdvance()
      });
    }
    stopTimers() {
      this.clearTimer(this.heartbeatTimer);
      this.clearTimer(this.deadlineTimer);
      this.heartbeatTimer = this.deadlineTimer = null;
    }
    assertScope() {
      if (this.scope !== this.captureScope()) {
        this.reset();
        throw failure("SESSION_CHANGED");
      }
    }
    reset() {
      this.epoch++;
      this.stopTimers();
      this.current = this.pendingStart = this.pendingAction = null;
      this.phase = "idle";
      this.requestedPause = false;
      this.scope = this.captureScope();
    }
    canAdvance() {
      return this.scope === this.captureScope() && this.visible && this.phase === "active" && !!this.current && this.now() < this.current.deadline;
    }
    apply(result, sentAt) {
      if (!result.allowed && result.allowed !== void 0) throw failure(result.reasonCode || "SERVICE_UNAVAILABLE");
      const mode = result.mode || this.current?.mode;
      const end = mode === "trial" ? result.leaseEndsAt : mode === "member" ? result.endsAt : Infinity;
      if (mode !== "free" && (!Number.isFinite(end) || !Number.isFinite(result.serverNow))) throw failure("SERVICE_UNAVAILABLE");
      const { unit, ...metadata } = result;
      void unit;
      this.current = {
        ...this.current,
        ...metadata,
        mode,
        sequence: result.sequence ?? this.current?.sequence ?? 0,
        remainingDeadline: result.remainingSeconds !== void 0 ? sentAt + result.remainingSeconds * 1e3 : this.current?.remainingDeadline,
        deadline: mode === "free" ? Infinity : sentAt + Math.max(0, end - result.serverNow)
      };
      this.phase = this.visible && !this.requestedPause ? "active" : "paused";
      this.schedule();
      this.emit();
    }
    schedule() {
      this.stopTimers();
      if (this.phase !== "active" || !this.current) return;
      const remaining = this.current.deadline - this.now();
      if (Number.isFinite(remaining)) this.deadlineTimer = this.setTimer(() => {
        if (this.now() < this.current?.deadline) {
          this.schedule();
          return;
        }
        this.phase = "blocked";
        this.stopTimers();
        this.emit("AUTHORIZATION_EXPIRED");
      }, Math.max(0, Math.min(remaining, 2147483647)));
      if (this.current.mode === "trial") this.heartbeatTimer = this.setTimer(() => {
        this.heartbeat().catch(() => {
        });
      }, Math.min(15e3, Math.max(0, remaining)));
    }
    async start(input) {
      this.assertScope();
      if (!this.visible) throw failure("PAGE_HIDDEN");
      if (this.busy) throw failure("REQUEST_IN_PROGRESS");
      if (this.pendingAction) await this.sendAction();
      if (this.current?.sessionId && this.phase === "active") throw failure("SESSION_IN_USE");
      const payload = { ...input };
      delete payload.requestId;
      if (this.pendingStart && JSON.stringify(this.pendingStart.input) !== JSON.stringify(payload)) throw failure("START_RETRY_REQUIRED");
      if (!this.pendingStart) this.pendingStart = { input: payload, requestId: this.newRequestId() };
      const sentAt = this.now(), epoch = this.epoch;
      this.requestedPause = false;
      this.busy = true;
      this.phase = "loading";
      this.emit();
      try {
        const result = await this.client.start({ ...payload, requestId: this.pendingStart.requestId });
        this.assertScope();
        if (epoch !== this.epoch) throw failure("SESSION_CHANGED");
        this.pendingStart = null;
        this.apply(result, sentAt);
        return result;
      } catch (error) {
        if (epoch === this.epoch) {
          if (error.status || error.code === "SESSION_CHANGED") this.pendingStart = null;
          this.phase = "blocked";
          this.stopTimers();
          this.emit(error.code || "CONNECTION_FAILED");
        }
        throw error;
      } finally {
        this.busy = false;
        if ((!this.visible || this.requestedPause) && this.current?.mode === "trial" && epoch === this.epoch) this.pause().catch(() => {
        });
      }
    }
    async sendAction() {
      this.assertScope();
      if (this.busy) throw failure("REQUEST_IN_PROGRESS");
      const pending2 = this.pendingAction;
      if (!pending2) return;
      const epoch = this.epoch, sentAt = this.now();
      this.busy = true;
      try {
        const result = await this.client.action(pending2.sessionId, pending2.sequence, pending2.action);
        this.assertScope();
        if (epoch !== this.epoch) throw failure("SESSION_CHANGED");
        this.pendingAction = null;
        if (pending2.action === "heartbeat") this.apply(result, sentAt);
        else {
          this.phase = "paused";
          this.current = null;
          this.stopTimers();
          this.emit();
        }
        return result;
      } catch (error) {
        if (epoch === this.epoch) {
          if (error.status) this.pendingAction = null;
          if (pending2.action !== "heartbeat" || !this.canAdvance()) this.phase = "blocked";
          this.emit(error.code || "CONNECTION_FAILED");
        }
        throw error;
      } finally {
        this.busy = false;
      }
    }
    async heartbeat() {
      this.assertScope();
      if (!this.current || this.current.mode !== "trial" || !this.visible) return;
      if (!this.pendingAction) this.pendingAction = { sessionId: this.current.sessionId, sequence: this.current.sequence + 1, action: "heartbeat" };
      try {
        return await this.sendAction();
      } finally {
        if ((!this.visible || this.requestedPause) && !this.busy && !this.pendingAction) this.pause().catch(() => {
        });
      }
    }
    async pause() {
      this.assertScope();
      this.requestedPause = true;
      this.phase = "paused";
      this.stopTimers();
      this.emit();
      if (this.busy || !this.current || this.current.mode !== "trial") return;
      if (this.pendingAction) await this.sendAction();
      if (!this.current) return;
      this.pendingAction = { sessionId: this.current.sessionId, sequence: this.current.sequence + 1, action: "pause" };
      return this.sendAction();
    }
    async read(courseId, unitId, cursor) {
      this.assertScope();
      if (!this.canAdvance()) throw failure("AUTHORIZATION_REQUIRED");
      const epoch = this.epoch, sentAt = this.now();
      try {
        const result = await this.client.read(courseId, unitId, cursor, this.current.sessionId);
        this.assertScope();
        if (epoch !== this.epoch || !this.canAdvance()) throw failure("AUTHORIZATION_EXPIRED");
        this.apply(result, sentAt);
        return result;
      } catch (error) {
        if (epoch === this.epoch && error.status) {
          this.phase = "blocked";
          this.stopTimers();
          this.emit(error.code || "SERVICE_UNAVAILABLE");
        }
        throw error;
      }
    }
    setVisible(visible) {
      this.visible = !!visible;
      if (!visible) this.pause().catch(() => {
      });
    }
    bindVisibility(doc, win) {
      const changed = () => this.setVisible(doc.visibilityState === "visible");
      const pagehide = () => this.setVisible(false);
      doc.addEventListener("visibilitychange", changed);
      win.addEventListener("pagehide", pagehide);
      changed();
      return () => {
        doc.removeEventListener("visibilitychange", changed);
        win.removeEventListener("pagehide", pagehide);
        this.setVisible(false);
      };
    }
  };

  // src/course-authoring/image-media-policy.mjs
  var IMAGE_MEDIA_POLICY = Object.freeze({
    maxFiles: 12,
    maxFileBytes: 2 * 1024 * 1024,
    maxTotalBytes: 8 * 1024 * 1024,
    maxBundleBytes: 12 * 1024 * 1024,
    maxDimension: 4096,
    maxPixels: 12e6,
    maxDraftBytes: 256 * 1024,
    types: Object.freeze({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" })
  });

  // src/course-authoring/adapters/image-file-reader.mjs
  var accepted = /* @__PURE__ */ new Map([["image/png", "png"], ["image/jpeg", "jpg"], ["image/webp", "webp"]]);
  var BrowserImageFileReader = class {
    constructor({ createBitmap = null, subtle = globalThis.crypto && globalThis.crypto.subtle } = {}) {
      this.createBitmap = createBitmap || ((file) => globalThis.createImageBitmap(file));
      this.subtle = subtle;
    }
    async read(file) {
      if (!file || !accepted.has(file.type)) throw new Error("\u56FE\u7247\u4EC5\u652F\u6301 PNG\u3001JPEG \u6216 WebP \u683C\u5F0F\u3002");
      if (file.size > IMAGE_MEDIA_POLICY.maxFileBytes) throw new Error(`\u56FE\u7247\u201C${file.name}\u201D\u8D85\u8FC7\u5355\u5F20 2 MiB \u9650\u5236\u3002`);
      const extension = accepted.get(file.type);
      const declared = String(file.name || "").split(".").pop().toLowerCase();
      if (!["jpg", "jpeg", "png", "webp"].includes(declared)) throw new Error(`\u56FE\u7247\u201C${file.name}\u201D\u7684\u6269\u5C55\u540D\u4E0E\u56FE\u7247\u683C\u5F0F\u4E0D\u5339\u914D\u3002`);
      const bytes = await file.arrayBuffer();
      if (!matchesSignature(new Uint8Array(bytes), file.type)) throw new Error(`\u56FE\u7247\u201C${file.name}\u201D\u7684\u6587\u4EF6\u5185\u5BB9\u4E0E\u58F0\u660E\u683C\u5F0F\u4E0D\u4E00\u81F4\u3002`);
      const bitmap = await this.createBitmap(file);
      const { width, height } = bitmap;
      bitmap.close();
      if (!width || !height || width > IMAGE_MEDIA_POLICY.maxDimension || height > IMAGE_MEDIA_POLICY.maxDimension || width * height > IMAGE_MEDIA_POLICY.maxPixels) throw new Error(`\u56FE\u7247\u201C${file.name}\u201D\u5C3A\u5BF8\u8FC7\u5927\uFF08\u6700\u957F\u8FB9\u4E0D\u8D85\u8FC7 4096\uFF0C\u50CF\u7D20\u4E0D\u8D85\u8FC7 1200 \u4E07\uFF09\u3002`);
      const digest = this.subtle ? hex(new Uint8Array(await this.subtle.digest("SHA-256", bytes))) : "";
      const dataUri = `data:${file.type};base64,${toBase64(new Uint8Array(bytes))}`;
      return { name: file.name, mimeType: file.type, extension, size: file.size, width, height, sha256: digest, dataUri, blob: file };
    }
  };
  function hex(bytes) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  function matchesSignature(bytes, mimeType) {
    if (mimeType === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
    if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (mimeType === "image/webp") return bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
    return false;
  }
  function toBase64(bytes) {
    let binary = "";
    for (let start = 0; start < bytes.length; start += 32768) binary += String.fromCharCode(...bytes.subarray(start, start + 32768));
    return globalThis.btoa(binary);
  }

  // src/membership/publication-view.mjs
  var make = (tag, text) => {
    const element2 = document.createElement(tag);
    if (text !== void 0) element2.textContent = text;
    return element2;
  };
  var CoursePublicationView = class {
    constructor({ root, request, newRequestId }) {
      this.root = root;
      this.request = request;
      this.newRequestId = newRequestId;
      this.busy = false;
      this.pending = null;
      this.prepareId = null;
      const title = make("h2", "\u53D1\u5E03\u65B0\u7684\u5E73\u53F0\u8BFE\u7A0B");
      const note = make("p", "1. \u9009\u62E9 AI \u8BFE\u7A0B JSON \u548C\u914D\u56FE\uFF1B2. \u6821\u9A8C\u5E76\u5BA1\u9605\uFF1B3. \u9009\u62E9\u514D\u8D39\u6216\u4F1A\u5458\u540E\u53D1\u5E03\u3002\u8FD9\u91CC\u53EA\u521B\u5EFA\u65B0\u8BFE\u7A0B\uFF0C\u73B0\u6709\u8BFE\u7A0B\u548C\u5B66\u4E60\u8BB0\u5F55\u4FDD\u6301\u539F\u6837\u3002");
      this.json = make("input");
      this.json.type = "file";
      this.json.accept = ".json,application/json";
      this.images = make("input");
      this.images.type = "file";
      this.images.accept = "image/png,image/jpeg,image/webp";
      this.images.multiple = true;
      const filesLabel = make("label", "\u8BFE\u7A0B JSON");
      filesLabel.append(this.json);
      const imagesLabel = make("label", "\u56FE\u6587\u8BFE\u7684\u539F\u59CB\u914D\u56FE\uFF08\u5355\u56FE \u2264 2 MiB\u3001\u603B\u56FE \u2264 8 MiB\uFF09");
      imagesLabel.append(this.images);
      this.level = make("select");
      this.level.className = "field";
      this.level.setAttribute("aria-label", "\u8BBF\u95EE\u7EA7\u522B");
      for (const [value, text] of [["free", "\u514D\u8D39\u8BFE\u7A0B"], ["member", "\u4F1A\u5458\u8BFE\u7A0B"]]) {
        const option = make("option", text);
        option.value = value;
        this.level.append(option);
      }
      const levelLabel = make("label", "\u8BBF\u95EE\u7EA7\u522B");
      levelLabel.append(this.level);
      this.prepareButton = make("button", "\u6821\u9A8C\u5E76\u9884\u89C8");
      this.prepareButton.type = "button";
      this.prepareButton.className = "btn";
      this.publishButton = make("button", "\u786E\u8BA4\u53D1\u5E03\u4E3A\u65B0\u8BFE\u7A0B");
      this.publishButton.type = "button";
      this.publishButton.className = "btn primary";
      this.preview = make("div");
      this.preview.setAttribute("role", "status");
      this.warning = make("input");
      this.warning.type = "checkbox";
      this.warningLabel = make("label", "\u6211\u5DF2\u5BA1\u9605\u6821\u9A8C\u63D0\u9192");
      this.warningLabel.className = "publication-warning";
      this.warningLabel.prepend(this.warning);
      this.warningLabel.hidden = true;
      this.status = make("p");
      this.status.setAttribute("role", "status");
      this.saved = make("select");
      this.saved.className = "field";
      this.saved.setAttribute("aria-label", "\u6700\u8FD1\u7684\u53D1\u5E03\u8349\u7A3F");
      const refresh = make("button", "\u5237\u65B0\u8349\u7A3F\u5217\u8868");
      refresh.type = "button";
      refresh.className = "btn";
      const restore = make("button", "\u6062\u590D\u9009\u4E2D\u8349\u7A3F");
      restore.type = "button";
      restore.className = "btn";
      this.root.replaceChildren(
        title,
        note,
        filesLabel,
        imagesLabel,
        this.prepareButton,
        this.preview,
        levelLabel,
        this.warningLabel,
        this.publishButton,
        this.status,
        make("h3", "\u6700\u8FD1\u7684\u53D1\u5E03\u8349\u7A3F"),
        this.saved,
        refresh,
        restore
      );
      const invalidate = () => {
        this.pending = null;
        this.prepareId = null;
        this.preview.textContent = "\u6587\u4EF6\u5DF2\u53D8\u66F4\uFF0C\u8BF7\u91CD\u65B0\u6821\u9A8C\u3002";
        this.sync();
      };
      this.json.onchange = this.images.onchange = invalidate;
      this.level.onchange = () => {
        if (this.pending) this.pending.requestId = newRequestId();
      };
      this.warning.onchange = () => this.sync();
      this.prepareButton.onclick = () => this.run(() => this.prepare());
      this.publishButton.onclick = () => this.run(() => this.publish());
      refresh.onclick = () => this.run(() => this.load());
      restore.onclick = () => this.run(async () => {
        if (!this.saved.value) return;
        this.showPreview(await request("/api/admin/membership/course-publications/" + encodeURIComponent(this.saved.value)));
      });
      this.sync();
    }
    sync() {
      for (const input of this.root.querySelectorAll("input,select,button")) input.disabled = this.busy;
      this.publishButton.disabled = this.busy || !this.pending || !this.warningLabel.hidden && !this.warning.checked;
    }
    async run(action) {
      if (this.busy) return;
      this.busy = true;
      this.sync();
      this.status.textContent = "\u6B63\u5728\u5904\u7406\u2026";
      try {
        await action();
      } catch (error) {
        if (error.code === "REGISTRY_CHANGED" && this.pending) {
          try {
            this.showPreview(await this.request("/api/admin/membership/course-publications/" + encodeURIComponent(this.pending.publicationId)));
          } catch (_) {
            this.pending = null;
          }
        }
        this.status.textContent = error.message || "\u8FDE\u63A5\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u76F8\u540C\u64CD\u4F5C\u3002";
        if (error.issues) {
          const list = make("ul");
          error.issues.forEach((issue) => list.append(make("li", issue.message + " " + (issue.suggestion || ""))));
          this.preview.replaceChildren(list);
        }
      } finally {
        this.busy = false;
        this.sync();
      }
    }
    showPreview(result) {
      this.pending = result.status === "published" ? null : { ...result, requestId: this.newRequestId() };
      this.preview.replaceChildren(make("p", result.title + " \xB7 " + (result.contentType === "sentence" ? "\u53E5\u5B50\u8BFE\u7A0B" : "\u56FE\u6587\u8BFE\u7A0B") + " \xB7 " + result.itemCount + " \u9879 \xB7 " + result.imageCount + " \u5F20\u914D\u56FE"));
      const issues = make("ul");
      for (const issue of result.issues || []) issues.append(make("li", issue.message));
      this.preview.append(issues);
      this.warningLabel.hidden = !(result.issues || []).some((issue) => issue.severity === "warning");
      this.warning.checked = false;
      this.status.textContent = result.status === "published" ? "\u8BE5\u8349\u7A3F\u5DF2\u53D1\u5E03\uFF0C\u65E0\u9700\u91CD\u590D\u53D1\u5E03\u3002" : "\u6821\u9A8C\u901A\u8FC7\uFF0C\u8BF7\u5BA1\u9605\u5185\u5BB9\u4E0E\u63D0\u9192\uFF0C\u518D\u786E\u8BA4\u53D1\u5E03\u3002\u6B64\u524D\u5DF2\u516C\u5F00\u6216\u4E0B\u8F7D\u7684\u526F\u672C\u65E0\u6CD5\u6536\u56DE\u3002";
      this.sync();
    }
    async prepare() {
      const file = this.json.files[0];
      if (!file) throw new Error("\u8BF7\u5148\u9009\u62E9\u8BFE\u7A0B JSON\u3002");
      if (file.size > 256 * 1024) throw new Error("\u8BFE\u7A0B JSON \u4E0D\u80FD\u8D85\u8FC7 256 KiB\u3002");
      const selected = Array.from(this.images.files);
      if (selected.length > 12 || selected.some((image) => image.size > 2 * 1024 * 1024) || selected.reduce((sum, image) => sum + image.size, 0) > 8 * 1024 * 1024) throw new Error("\u914D\u56FE\u6570\u91CF\u6216\u5927\u5C0F\u8D85\u8FC7\u9650\u5236\u3002");
      let draft;
      try {
        draft = JSON.parse((await file.text()).replace(/^\uFEFF/, ""));
      } catch (_) {
        throw new Error("\u8BFE\u7A0B JSON \u65E0\u6CD5\u8BFB\u53D6\uFF0C\u8BF7\u9009\u62E9\u7F51\u7AD9\u652F\u6301\u7684\u8BFE\u7A0B JSON \u6587\u4EF6\u3002");
      }
      const reader = new BrowserImageFileReader();
      const images = await Promise.all(selected.map(async (image) => {
        const file2 = await reader.read(image);
        return { name: file2.name, mimeType: file2.mimeType, base64: file2.dataUri.split(",")[1] };
      }));
      if (!this.prepareId) this.prepareId = this.newRequestId();
      this.showPreview(await this.request("/api/admin/membership/course-publications/prepare", { method: "POST", body: JSON.stringify({ draft, images, requestId: this.prepareId }) }));
      await this.load();
    }
    async publish() {
      if (!this.pending) return;
      const result = await this.request("/api/admin/membership/course-publications/publish", { method: "POST", body: JSON.stringify({
        publicationId: this.pending.publicationId,
        contentHash: this.pending.contentHash,
        registryVersion: this.pending.registryVersion,
        accessLevel: this.level.value,
        acceptWarnings: this.warning.checked,
        requestId: this.pending.requestId
      }) });
      this.pending = null;
      this.status.textContent = "\u65B0\u8BFE\u7A0B\u5DF2\u53D1\u5E03\u3002";
      const link = make("a", "\u6253\u5F00\u5DF2\u53D1\u5E03\u8BFE\u7A0B");
      link.href = "main.html?protectedCourse=" + encodeURIComponent(result.courseId);
      this.status.append(" ", link);
      await this.load();
    }
    async load() {
      const result = await this.request("/api/admin/membership/course-publications");
      this.saved.replaceChildren(...result.publications.map((row) => {
        const option = make("option", row.title + (row.status === "published" ? "\uFF08\u5DF2\u53D1\u5E03\uFF09" : "\uFF08\u8349\u7A3F\uFF09"));
        option.value = row.publicationId;
        return option;
      }));
      if (this.status.textContent === "\u6B63\u5728\u5904\u7406\u2026") this.status.textContent = "\u9009\u62E9\u6587\u4EF6\u8FDB\u884C\u6821\u9A8C\uFF0C\u6216\u6062\u590D\u5DF2\u6709\u8349\u7A3F\u3002";
    }
  };

  // src/membership/history-index.mjs
  async function buildProtectedHistoryDecks({ courses, stats, digest }) {
    const byDeck = /* @__PURE__ */ new Map();
    const registered = new Set((courses || []).flatMap((course) => (course.units || []).map((unit) => unit.recordIdentity?.deckId).filter(Boolean)));
    for (const [key, stat] of Object.entries(stats || {})) {
      const separator = key.indexOf("#");
      if (separator < 1 || !key.startsWith("protected_") && !registered.has(key.slice(0, separator))) continue;
      const id = key.slice(0, separator);
      if (!byDeck.has(id)) byDeck.set(id, []);
      byDeck.get(id).push({ cid: key.slice(separator + 1), stat });
    }
    const matched = /* @__PURE__ */ new Map();
    await Promise.all((courses || []).flatMap((course) => (course.units || []).map(async (unit) => {
      const id = unit.recordIdentity?.deckId || "protected_" + await digest(JSON.stringify([course.courseId, unit.unitId]));
      if (byDeck.has(id)) matched.set(id, { course, unit });
    })));
    return [...byDeck].map(([id, records]) => {
      const source = matched.get(id);
      const title = source?.course.title || "\u5E73\u53F0\u8BFE\u7A0B\u5B66\u4E60\u8BB0\u5F55";
      return {
        id,
        name: title,
        _protectedHistory: true,
        _protectedCourseId: source?.course.courseId,
        items: records.map(({ cid, stat }, index) => {
          const evidence = Array.isArray(stat.learningV1?.evidence) ? stat.learningV1.evidence : [];
          const latest = evidence.filter((event) => event && event.type === "assessment").slice().sort((a, b) => a.at - b.at).at(-1);
          return {
            cid,
            sentence: stat.sentence || title + " \xB7 \u5DF2\u5B66\u5185\u5BB9 " + (index + 1),
            translation: "\u5B66\u4E60\u8BB0\u5F55\u4FDD\u7559\uFF1B\u6253\u5F00\u8BFE\u7A0B\u540E\u68C0\u67E5\u5F53\u524D\u5B66\u4E60\u6743\u9650\u3002",
            ...latest ? { _protectedAssessmentHistory: "\u6700\u8FD1" + (latest.stage === "initial" ? "\u521D\u6D4B" : "\u590D\u6D4B") + (latest.ok ? "\u901A\u8FC7" : "\u672A\u901A\u8FC7") + "\uFF08\u5386\u53F2\u8BB0\u5F55\uFF09" } : {},
            _protectedHistory: true,
            ...source ? {
              _protectedReviewUrl: "main.html?protectedCourse=" + encodeURIComponent(source.course.courseId) + "&unit=" + encodeURIComponent(source.unit.unitId) + "&reviewItem=" + encodeURIComponent(cid),
              _protectedAssessmentUrl: "main.html?protectedCourse=" + encodeURIComponent(source.course.courseId) + "&unit=" + encodeURIComponent(source.unit.unitId) + "&assessmentItem=" + encodeURIComponent(cid)
            } : {}
          };
        })
      };
    });
  }

  // src/learning/course-content-gateway.mjs
  var failure2 = (code) => Object.assign(new Error(code), { code });
  var CourseContentGateway = class {
    constructor({ sources, captureScope }) {
      this.sources = sources;
      this.captureScope = captureScope;
      this.scope = captureScope();
      this.epoch = 0;
      this.source = null;
      this.course = null;
      this.cache = /* @__PURE__ */ new Map();
      this.pending = /* @__PURE__ */ new Map();
      this.currentCursor = null;
    }
    guard(epoch = this.epoch) {
      if (epoch !== this.epoch) throw failure2("SESSION_CHANGED");
      if (this.scope !== this.captureScope()) {
        this.dispose();
        throw failure2("SESSION_CHANGED");
      }
    }
    resolve(reference) {
      this.guard();
      const source = this.sources[reference?.origin];
      if (!source) throw failure2("UNSUPPORTED_COURSE_SOURCE");
      return source;
    }
    async open(reference, options = {}) {
      const source = this.resolve(reference);
      if (this.source) await this.pause();
      this.epoch++;
      this.cache.clear();
      this.pending.clear();
      this.currentCursor = null;
      this.source = source;
      this.course = { ...reference };
      const epoch = this.epoch;
      try {
        const first = await source.open(reference, options);
        this.guard(epoch);
        if (!first?.batch || !first.contentVersion || !first.recordIdentity) throw failure2("CONTENT_CONTRACT_INVALID");
        this.contentVersion = first.contentVersion;
        this.recordIdentity = Object.freeze({ ...first.recordIdentity });
        this.put(first.batch);
        this.currentCursor = first.batch.cursor;
        return { ...first, batch: structuredClone(first.batch), recordIdentity: this.recordIdentity };
      } catch (error) {
        if (epoch === this.epoch) this.dispose();
        throw error;
      }
    }
    put(batch) {
      if (!Number.isSafeInteger(batch?.cursor) || !Array.isArray(batch.items) || !batch.items.length || batch.items.length > (batch.contentType === "image-text" ? 1 : 10)) throw failure2("CONTENT_BATCH_INVALID");
      this.cache.set(batch.cursor, structuredClone(batch));
      this.trim();
    }
    trim() {
      const current = this.cache.get(this.currentCursor), next = current?.nextCursor;
      for (const cursor of this.cache.keys()) {
        if (this.cache.size <= 2) break;
        if (cursor !== this.currentCursor && cursor !== next) this.cache.delete(cursor);
      }
    }
    checkAdvance() {
      this.guard();
      return !!this.source && !!this.cache.get(this.currentCursor) && this.source.checkAdvance(this.currentCursor);
    }
    async loadBatch(cursor, { prefetch = false } = {}) {
      this.guard();
      if (!this.source || !this.contentVersion) throw failure2("COURSE_NOT_OPEN");
      const epoch = this.epoch, source = this.source;
      if (prefetch) {
        const current = this.cache.get(this.currentCursor);
        if (!current || current.nextCursor !== cursor || !this.checkAdvance() || !source.canPrefetch()) return null;
      }
      const cached = this.cache.get(cursor);
      if (cached) {
        await source.authorizeCached(cursor);
        this.guard(epoch);
        if (!prefetch) {
          this.currentCursor = cursor;
          this.trim();
        }
        return structuredClone(cached);
      }
      if (!this.pending.has(cursor)) {
        const promise = (async () => {
          const result = await source.loadBatch(cursor);
          this.guard(epoch);
          if (result.contentVersion !== this.contentVersion) throw failure2("CONTENT_VERSION_CHANGED");
          if (result.batch.cursor !== cursor) throw failure2("CONTENT_CURSOR_MISMATCH");
          if (!prefetch) this.currentCursor = cursor;
          this.put(result.batch);
          return result.batch;
        })();
        this.pending.set(cursor, promise);
      }
      let batch;
      try {
        batch = await this.pending.get(cursor);
      } finally {
        if (epoch === this.epoch) this.pending.delete(cursor);
      }
      this.guard(epoch);
      if (!prefetch) {
        this.currentCursor = cursor;
        this.trim();
      }
      return structuredClone(batch);
    }
    async loadAssets(assetId) {
      this.guard();
      const batch = this.cache.get(this.currentCursor), epoch = this.epoch;
      if (!batch?.assetIds?.includes(assetId)) throw failure2("ASSET_NOT_AUTHORIZED");
      const result = await this.source.loadAssets(assetId, this.currentCursor);
      this.guard(epoch);
      return result;
    }
    async pause() {
      this.guard();
      if (this.source) await this.source.pause();
    }
    dispose() {
      this.epoch++;
      this.cache.clear();
      this.pending.clear();
      this.currentCursor = null;
      const source = this.source;
      this.source = null;
      this.course = null;
      this.contentVersion = null;
      this.recordIdentity = null;
      source?.dispose();
    }
  };

  // src/learning/platform-course-source.mjs
  var failure3 = (code) => Object.assign(new Error(code), { code });
  var PlatformCourseSource = class {
    constructor({ client, controller, fetchResource, newRequestId, imageCache, captureImageScope, monotonicNow = () => performance.now() }) {
      this.client = client;
      this.controller = controller;
      this.fetchResource = fetchResource;
      this.newRequestId = newRequestId;
      this.now = monotonicNow;
      this.grants = /* @__PURE__ */ new Map();
      this.epoch = 0;
      this.imageCache = imageCache;
      this.captureImageScope = captureImageScope;
    }
    remember(result, sentAt, cursor = result.fragments?.[0]?.cursor) {
      if (!result.grant || result.headerName !== "X-Course-Grant" || !Number.isFinite(result.expiresAt) || !Number.isFinite(result.serverNow) || result.fragments?.length !== 1) throw failure3("CONTENT_GRANT_INVALID");
      if (this.contentVersion && result.contentVersion !== this.contentVersion) throw failure3("CONTENT_VERSION_CHANGED");
      const fragment = result.fragments[0];
      const { unit, session, ...metadata } = result;
      void unit;
      void session;
      this.grants.set(cursor, { ...metadata, fragment, deadline: sentAt + Math.min(3e4, Math.max(0, result.expiresAt - result.serverNow)) });
      while (this.grants.size > 2) this.grants.delete(this.grants.keys().next().value);
    }
    async open(reference, options = {}) {
      this.grants.clear();
      this.contentVersion = null;
      this.reference = reference;
      this.purpose = options.purpose || "practice";
      const epoch = ++this.epoch, sentAt = this.now();
      const result = await this.controller.start({ courseId: reference.courseId, unitId: reference.unitId, cursor: options.cursor || 0, purpose: this.purpose });
      if (epoch !== this.epoch) throw failure3("SESSION_CHANGED");
      this.remember(result, sentAt, result.unit?.cursor);
      this.contentVersion = result.contentVersion;
      return { batch: result.unit, contentVersion: result.contentVersion, recordIdentity: result.unit.recordIdentity };
    }
    checkAdvance(cursor) {
      return this.controller.canAdvance() && this.now() < (this.grants.get(cursor)?.deadline || 0);
    }
    canPrefetch() {
      return this.controller.canAdvance() && Math.max(0, ...[...this.grants.values()].map((grant) => grant.deadline - this.now())) >= 5e3;
    }
    async grantFor(cursor) {
      if (!this.controller.canAdvance()) throw failure3("AUTHORIZATION_EXPIRED");
      let grant = this.grants.get(cursor);
      if (grant && this.now() < grant.deadline) return grant;
      const epoch = this.epoch, sentAt = this.now();
      const result = await this.client.contentGrant({ ...this.reference, cursor, purpose: this.purpose, sessionId: this.controller.current?.sessionId, requestId: this.newRequestId() });
      if (epoch !== this.epoch) throw failure3("SESSION_CHANGED");
      this.remember(result, sentAt, cursor);
      grant = this.grants.get(cursor);
      if (!grant || !this.checkAdvance(cursor)) throw failure3("AUTHORIZATION_EXPIRED");
      return grant;
    }
    async authorizeCached(cursor) {
      await this.grantFor(cursor);
    }
    headers(grant) {
      return { "X-Course-Grant": grant.grant, "X-Course-Id": this.reference.courseId, "X-Course-Unit": this.reference.unitId, "X-Course-Purpose": this.purpose };
    }
    async loadBatch(cursor) {
      const epoch = this.epoch, grant = await this.grantFor(cursor);
      const batch = await this.fetchResource("/api/course-fragments/" + encodeURIComponent(grant.fragment.fragmentId), this.headers(grant), "json");
      if (epoch !== this.epoch || !this.checkAdvance(cursor)) throw failure3("AUTHORIZATION_EXPIRED");
      batch.items = batch.items.slice(cursor - batch.cursor);
      batch.cursor = cursor;
      return { batch, contentVersion: grant.contentVersion };
    }
    async loadAssets(assetId, cursor) {
      const epoch = this.epoch, grant = await this.grantFor(cursor);
      if (!grant.fragment.assetIds.includes(assetId)) throw failure3("ASSET_NOT_AUTHORIZED");
      const guard = () => {
        if (epoch !== this.epoch || !this.checkAdvance(cursor)) throw failure3("AUTHORIZATION_EXPIRED");
      };
      const download = () => this.fetchResource("/api/course-assets/" + encodeURIComponent(assetId), this.headers(grant), "blob");
      const result = this.imageCache ? await this.imageCache.load({
        scope: this.captureImageScope(),
        courseId: this.reference.courseId,
        contentVersion: grant.contentVersion,
        assetId,
        download,
        guard
      }) : await download();
      guard();
      return result;
    }
    async pause() {
      this.grants.clear();
      await this.controller.pause();
    }
    dispose() {
      const epoch = ++this.epoch;
      this.grants.clear();
      this.controller.pause().catch(() => {
      }).finally(() => {
        if (epoch === this.epoch) this.controller.reset();
      });
    }
  };

  // src/learning/course-image-cache.mjs
  var IMAGE_CACHE_PREFIX = "course-images-v1-";
  var pending = /* @__PURE__ */ new Map();
  var revisions = /* @__PURE__ */ new Map();
  function imageCacheScope(win) {
    return JSON.stringify([win.ChunkAPI.getBase(), win.AccountStorage.owner]);
  }
  var CourseImageCache = class {
    constructor(win = globalThis) {
      this.win = win;
    }
    async name(scope) {
      const bytes = new TextEncoder().encode(scope);
      const digest = await this.win.crypto.subtle.digest("SHA-256", bytes);
      return IMAGE_CACHE_PREFIX + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    }
    async load({ scope, courseId, contentVersion, assetId, download, guard }) {
      guard();
      if (!this.win.caches || !this.win.crypto?.subtle) {
        const blob = await download();
        guard();
        return blob;
      }
      let name, cache;
      try {
        name = await this.name(scope);
        cache = await this.win.caches.open(name);
      } catch (_) {
        const blob = await download();
        guard();
        return blob;
      }
      guard();
      const key = new URL("/__course_image_cache__/" + encodeURIComponent(JSON.stringify([courseId, contentVersion, assetId])), this.win.location.origin).href;
      const revision = revisions.get(name) || 0, flightKey = name + ":" + revision + ":" + key;
      if (!pending.has(flightKey)) {
        const task2 = (async () => {
          let response;
          try {
            response = await cache.match(key);
          } catch (_) {
          }
          guard();
          if (response) {
            try {
              const blob2 = await response.blob();
              if (blob2.size && /^image\//.test(blob2.type) && Number(response.headers.get("X-Image-Bytes")) === blob2.size) return blob2;
            } catch (_) {
            }
          }
          const blob = await download();
          guard();
          if (blob.size && /^image\//.test(blob.type) && revision === (revisions.get(name) || 0)) {
            try {
              await cache.put(key, new Response(blob, { headers: { "Content-Type": blob.type, "X-Image-Bytes": String(blob.size) } }));
            } catch (_) {
            }
          }
          return blob;
        })();
        pending.set(flightKey, task2);
      }
      const task = pending.get(flightKey);
      try {
        const blob = await task;
        guard();
        return blob;
      } finally {
        if (pending.get(flightKey) === task) pending.delete(flightKey);
      }
    }
    async usage(scope) {
      if (!this.win.caches || !this.win.crypto?.subtle) return null;
      const name = await this.name(scope);
      if (!(await this.win.caches.keys()).includes(name)) return { count: 0, bytes: 0 };
      const cache = await this.win.caches.open(name), entries = await cache.matchAll();
      return { count: entries.length, bytes: entries.reduce((total, entry) => total + (Number(entry.headers.get("X-Image-Bytes")) || 0), 0) };
    }
    async clear(scope) {
      if (!this.win.caches || !this.win.crypto?.subtle) throw new Error("IMAGE_CACHE_UNAVAILABLE");
      const name = await this.name(scope);
      revisions.set(name, (revisions.get(name) || 0) + 1);
      await this.win.caches.delete(name);
    }
  };

  // src/learning/native-course-session.mjs
  var messages = {
    AUTH_REQUIRED: "\u8BF7\u5148\u767B\u5F55\uFF0C\u518D\u67E5\u770B\u4E2A\u4EBA\u5B66\u4E60\u5185\u5BB9\u3002",
    NOT_AUTH: "\u767B\u5F55\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55\u540E\u7EE7\u7EED\u3002",
    SERVER_SEQ_ROLLBACK: "\u5B66\u4E60\u6570\u636E\u7248\u672C\u9700\u8981\u6838\u67E5\uFF0C\u539F\u8BB0\u5F55\u5DF2\u4FDD\u7559\u3002\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458\u534F\u52A9\u68C0\u67E5\u3002",
    SERVER_IDENTITY_REQUIRED: "\u670D\u52A1\u7AEF\u672A\u786E\u8BA4\u8D26\u53F7\uFF0C\u5DF2\u6682\u505C\u540C\u6B65\uFF1B\u672C\u5730\u8BB0\u5F55\u4FDD\u7559\u3002\u8BF7\u66F4\u65B0\u670D\u52A1\u540E\u91CD\u8BD5\u3002",
    SERVER_IDENTITY_MISMATCH: "\u670D\u52A1\u7AEF\u54CD\u5E94\u8D26\u53F7\u4E0D\u4E00\u81F4\uFF0C\u5DF2\u6682\u505C\u540C\u6B65\uFF1B\u672C\u5730\u8BB0\u5F55\u4FDD\u7559\u3002",
    SERVER_UPDATE_REQUIRED: "\u670D\u52A1\u7AEF\u7248\u672C\u6216\u767B\u5F55\u914D\u7F6E\u9700\u8981\u66F4\u65B0\uFF0C\u539F\u6709\u8BB0\u5F55\u5DF2\u4FDD\u7559\u3002",
    CONTENT_PREPARATION_REQUIRED: "\u8BFE\u7A0B\u6682\u65F6\u65E0\u6CD5\u5F00\u59CB\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002\u539F\u8BFE\u7A0B\u548C\u8BB0\u5F55\u4ECD\u7136\u4FDD\u7559\u3002",
    TRIAL_DAILY_LIMIT: "\u672C\u5468\u671F\u4F53\u9A8C\u65F6\u957F\u5DF2\u7528\u5B8C\u3002\u53EF\u7B49\u5F85\u989D\u5EA6\u6062\u590D\uFF0C\u6216\u5151\u6362\u4F1A\u5458\u7EE7\u7EED\u3002",
    TRIAL_EXPIRED: "\u514D\u8D39\u4F53\u9A8C\u5DF2\u7ED3\u675F\uFF0C\u53EF\u5151\u6362\u4F1A\u5458\u7EE7\u7EED\u5B66\u4E60\u3002",
    MEMBERSHIP_REQUIRED: "\u5F53\u524D\u6CA1\u6709\u6709\u6548\u4F1A\u5458\uFF0C\u53EF\u5151\u6362\u4F1A\u5458\u7EE7\u7EED\u5B66\u4E60\u3002",
    TRIAL_DISABLED: "\u672C\u8BFE\u7A0B\u6682\u672A\u5F00\u653E\u4F53\u9A8C\uFF0C\u53EF\u5151\u6362\u4F1A\u5458\u5B66\u4E60\u3002",
    SESSION_IN_USE: "\u53E6\u4E00\u4E2A\u9875\u9762\u6B63\u5728\u8BD5\u5B66\uFF0C\u8BF7\u5148\u6682\u505C\u8BE5\u9875\u9762\u3002",
    AUTHORIZATION_EXPIRED: "\u5B66\u4E60\u5DF2\u6682\u505C\uFF0C\u8BF7\u70B9\u201C\u7EE7\u7EED\u5B66\u4E60\u201D\u3002\u5F53\u524D\u4F4D\u7F6E\u548C\u5DF2\u5B8C\u6210\u7B54\u6848\u4FDD\u7559\u3002",
    SESSION_CHANGED: "\u767B\u5F55\u8D26\u53F7\u5DF2\u53D8\u5316\uFF0C\u8BF7\u5237\u65B0\u540E\u7EE7\u7EED\u3002",
    CONTENT_VERSION_CHANGED: "\u8BFE\u7A0B\u7248\u672C\u5DF2\u53D8\u5316\uFF0C\u8BF7\u8FD4\u56DE\u8BFE\u7A0B\u5E93\u91CD\u65B0\u8FDB\u5165\u3002",
    ASSESSMENT_NOT_ELIGIBLE: "\u8FD9\u9879\u5185\u5BB9\u5C1A\u672A\u5230\u590D\u6D4B\u65F6\u95F4\uFF0C\u8BF7\u6309\u539F\u590D\u6D4B\u5468\u671F\u7A0D\u540E\u518D\u8BD5\u3002"
  };
  var errorText = (error) => messages[error?.code] || (error?.message?.includes("\u6700\u591A\u52A0\u5165") ? error.message : "\u8BFE\u7A0B\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u540E\u91CD\u8BD5\u3002\u5B66\u4E60\u8BB0\u5F55\u4ECD\u7136\u4FDD\u7559\u3002");
  function element(doc, tag, text, className) {
    const node = doc.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function placeAccessPanel(host, panel) {
    const context = host.querySelector(".stage-tip-bar");
    if (context) context.after(panel);
    else host.prepend(panel);
  }
  function projectNativeBatch(batch, title, unitCount) {
    const identity = batch.recordIdentity;
    if (!identity?.deckId || !identity.generationScope?.startsWith("course:")) throw Object.assign(new Error("CONTENT_IDENTITY_INVALID"), { code: "CONTENT_IDENTITY_INVALID" });
    const items = batch.items.map((source) => {
      if (batch.contentType === "sentence") return { ...structuredClone(source), chunks: source.chunks?.length ? source.chunks : [source.sentence] };
      const text = typeof source.text === "string" ? { en: source.text } : source.text || {};
      const chunkSet = source.chunks;
      const chunks = Array.isArray(chunkSet) ? chunkSet : chunkSet?.correctOrder?.map((id) => chunkSet.items.find((chunk) => chunk.id === id)?.text.trim());
      return {
        ...structuredClone(source),
        cid: source.id,
        sentence: text.en,
        translation: text["zh-CN"] || "",
        chunks: chunks?.length ? chunks : [text.en],
        hints: source.hints || [],
        ...chunkSet?.distractors?.length ? { distractors: chunks.map(() => chunkSet.distractors.map((chunk) => chunk.text)) } : {}
      };
    });
    if (items.some((item) => !Array.isArray(item.chunks) || !item.chunks.length || item.chunks.some((chunk) => typeof chunk !== "string" || !chunk.trim()))) throw Object.assign(new Error("CONTENT_CHUNKS_INVALID"), { code: "CONTENT_CHUNKS_INVALID" });
    const authoring = batch.context?.authoring || (batch.learning ? {
      template: "sentence-practice",
      templateVersion: 1,
      learning: batch.learning,
      contentForm: batch.contentType === "image-text" ? "article" : "sentences",
      roles: batch.context?.roles || []
    } : void 0);
    return {
      id: identity.deckId,
      name: title,
      short: title,
      builtin: true,
      items,
      itemCount: unitCount,
      statsDeckId: identity.deckId,
      _reviewOnly: false,
      ...authoring ? { authoring } : {},
      _recordIdentity: identity,
      _sourceIndices: items.map((_, index) => batch.cursor + index),
      _contentBatch: {
        startCursor: batch.cursor,
        nextCursor: batch.nextCursor,
        done: batch.nextCursor === null,
        remainingCount: Math.max(0, unitCount - batch.cursor - items.length)
      }
    };
  }
  var NativeCourseSession = class {
    /** @param {{host:HTMLElement,courseId:string,unitId?:string,getMem:()=>any,onBatch:(deck:any,fromIdx:number,generation:number)=>void,win?:any}} options */
    constructor({ host, courseId, unitId, getMem, onBatch, win = window }) {
      this.win = win;
      this.host = host;
      this.courseId = courseId;
      this.unitId = unitId;
      this.getMem = getMem;
      this.onBatch = onBatch;
      this.disposed = false;
      this.urls = /* @__PURE__ */ new Set();
      this.busy = false;
      this.cursor = 0;
      const doc = host.ownerDocument;
      this.panel = element(doc, "section", "", "course-access-panel");
      this.panel.setAttribute("aria-live", "polite");
      this.status = element(doc, "p", "\u6B63\u5728\u8BFB\u53D6\u8BFE\u7A0B\u548C\u5B66\u4E60\u8BB0\u5F55\u2026");
      this.button = element(doc, "button", "\u5F00\u59CB\u5B66\u4E60", "btn primary");
      this.button.hidden = true;
      this.button.onclick = () => this.start(this.started).catch((error) => this.showError(error));
      const account = element(doc, "a", "\u8D26\u53F7\u4E0E\u5151\u6362\u4F1A\u5458", "btn");
      account.href = "main.html?membership=1&returnTo=" + encodeURIComponent(win.location.pathname + win.location.search);
      this.panel.append(this.status, this.button, account);
      placeAccessPanel(host, this.panel);
      this.captureScope = () => JSON.stringify([win.AccountStorage.owner, win.AccountStorage.sessionEpoch, win.ChunkAPI.getBase(), win.ChunkAPI.getToken()]);
      this.scope = this.captureScope();
      this.client = new MembershipClient({
        request: (url, options) => win.ChunkAPI.request(url, options),
        readCatalog: () => win.ChunkAPI.getCourseCatalog()
      });
      this.controller = new LearningSessionController({
        client: this.client,
        newRequestId: () => win.crypto.randomUUID(),
        captureScope: this.captureScope,
        onState: (state) => {
          if (!this.disposed && ["blocked", "paused"].includes(state.phase) && this.started) this.showError({ code: "AUTHORIZATION_EXPIRED" });
        }
      });
      const source = new PlatformCourseSource({
        client: this.client,
        controller: this.controller,
        newRequestId: () => win.crypto.randomUUID(),
        imageCache: new CourseImageCache(win),
        captureImageScope: () => imageCacheScope(win),
        fetchResource: async (url, headers, type) => {
          this.guard();
          const response = await win.fetch(win.ChunkAPI.getBase() + url, { headers: { ...headers, Authorization: "Bearer " + win.ChunkAPI.getToken() }, cache: "no-store" });
          this.guard();
          if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            throw Object.assign(new Error(result.reasonCode || "CONTENT_UNAVAILABLE"), { code: result.reasonCode, status: response.status });
          }
          return type === "blob" ? response.blob() : response.json();
        }
      });
      this.gateway = new CourseContentGateway({ sources: { platform: source }, captureScope: this.captureScope });
      this.unbind = this.controller.bindVisibility(doc, win);
    }
    guard() {
      if (this.disposed || this.scope !== this.captureScope()) throw Object.assign(new Error("SESSION_CHANGED"), { code: "SESSION_CHANGED" });
    }
    async open() {
      await this.win.LearningSessionBootstrap.ready();
      this.guard();
      const catalog = await this.client.catalog();
      this.guard();
      this.course = catalog.courses.find((course) => course.courseId === this.courseId);
      this.unit = this.course?.units.find((unit) => unit.unitId === this.unitId) || !this.unitId && this.course?.units[0];
      if (!this.unit?.recordIdentity) throw Object.assign(new Error("CONTENT_PREPARATION_REQUIRED"), { code: "CONTENT_PREPARATION_REQUIRED" });
      this.unitId = this.unit.unitId;
      if (this.course.units.length > 1 && !this.unitSelect) {
        this.unitSelect = element(this.host.ownerDocument, "select");
        this.unitSelect.setAttribute("aria-label", "\u8BFE\u8282");
        this.course.units.forEach((unit, index) => {
          const option = element(this.host.ownerDocument, "option", "\u7B2C " + (index + 1) + " \u8282");
          option.value = unit.unitId;
          this.unitSelect.append(option);
        });
        this.unitSelect.value = this.unitId;
        this.unitSelect.onchange = () => {
          const url = new URL(this.win.location.href);
          url.searchParams.set("unit", this.unitSelect.value);
          this.win.location.assign(url.href);
        };
        this.panel.prepend(this.unitSelect);
      }
      const saved = this.getMem().progress?.[this.unit.recordIdentity.deckId];
      const requested = new URL(this.win.location.href).searchParams.get("reviewItem");
      this.reviewOnly = !!requested;
      const itemCursor = requested ? this.unit.itemIds.indexOf(requested) : -1;
      this.cursor = itemCursor >= 0 ? itemCursor : Math.min(this.unit.itemCount - 1, Math.max(0, Number(saved?.idx) || 0));
      this.status.textContent = this.course.title + (this.course.accessLevel === "member" ? " \xB7 \u4F1A\u5458\u8BFE\u7A0B" : " \xB7 \u514D\u8D39\u8BFE\u7A0B");
      this.button.textContent = saved ? "\u7EE7\u7EED\u5B66\u4E60" : "\u5F00\u59CB\u5B66\u4E60";
      this.button.hidden = false;
      return this;
    }
    showError(error) {
      this.lastError = error;
      if (this.disposed) return;
      const paused = ["AUTH_REQUIRED", "NOT_AUTH", "SERVER_SEQ_ROLLBACK", "SERVER_IDENTITY_REQUIRED", "SERVER_IDENTITY_MISMATCH", "SERVER_UPDATE_REQUIRED"].includes(error?.code);
      this.panel.hidden = false;
      this.status.textContent = errorText(error);
      this.button.hidden = paused;
      this.button.textContent = this.started ? "\u7EE7\u7EED\u5B66\u4E60" : "\u91CD\u8BD5";
      this.button.disabled = false;
    }
    updateClock() {
      if (this.disposed || !this.started || !this.button.hidden || !this.controller.current) return;
      const current = this.controller.current;
      if (current.mode === "free") this.status.textContent = "\u514D\u8D39\u8BFE\u7A0B \xB7 \u4E0D\u9650\u65F6";
      else if (current.mode === "member") this.status.textContent = "\u4F1A\u5458\u6709\u6548\u81F3 " + new Date(current.endsAt).toLocaleString();
      else {
        const seconds = Math.max(0, Math.ceil(((current.remainingDeadline || current.deadline) - this.controller.now()) / 1e3));
        this.status.textContent = "\u672C\u5468\u671F\u4F53\u9A8C\u5269\u4F59 " + String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
      }
    }
    async start(preserve = false) {
      this.guard();
      if (this.busy) return;
      this.busy = true;
      this.button.disabled = true;
      try {
        if (!this.course) await this.open();
        if (!this.win.CourseEnrollment.isJoined(this.courseId)) await this.win.CourseEnrollment.join(this.courseId);
        this.guard();
        const snapshot = await this.win.ServerCache.read();
        this.guard();
        if (!snapshot || snapshot.owner !== this.win.AccountStorage.owner) throw new Error("UNCONFIRMED_LEARNING_STATE");
        this.generation = Number(snapshot.snapshot.learningGenerations?.[this.unit.recordIdentity.generationScope]) || 0;
        if (this.started) await this.gateway.pause().catch((error) => {
          if (!error.status) throw error;
          this.controller.reset();
        });
        const result = await this.gateway.open({ origin: "platform", courseId: this.courseId, unitId: this.unitId }, { cursor: this.cursor });
        this.guard();
        if (preserve && this.contentVersion !== result.contentVersion) throw Object.assign(new Error("CONTENT_VERSION_CHANGED"), { code: "CONTENT_VERSION_CHANGED" });
        this.contentVersion = result.contentVersion;
        this.started = true;
        this.button.hidden = true;
        this.updateClock();
        if (!this.clockTimer) this.clockTimer = this.win.setInterval(() => this.updateClock(), 1e3);
        if (!preserve) await this.deliver(result.batch);
      } catch (error) {
        this.showError(error);
        throw error;
      } finally {
        this.busy = false;
        this.button.disabled = false;
      }
    }
    async deliver(batch) {
      this.guard();
      const deck = projectNativeBatch(batch, this.course.title, this.unit.itemCount);
      if (this.reviewOnly) {
        deck.id = "rev-native-" + this.win.crypto.randomUUID();
        deck.statsDeckId = batch.recordIdentity.deckId;
        deck.items = deck.items.slice(0, 1);
        deck._sourceIndices = [batch.cursor];
        deck._contentBatch = null;
        deck._reviewOnly = true;
      }
      for (let index = deck.items.length - 1; index >= 0; index--) {
        if (this.win.CL.isItemDeleted(this.getMem(), batch.recordIdentity.deckId, deck.items[index])) {
          deck.items.splice(index, 1);
          deck._sourceIndices.splice(index, 1);
        }
      }
      const urls = /* @__PURE__ */ new Set(), assetUrls = /* @__PURE__ */ new Map();
      try {
        for (const item of deck.items) {
          for (const [field, target] of [["imageAssetId", "_courseImageUrl"], ["audioAssetId", "_courseAudioUrl"]]) {
            if (!item[field]) continue;
            if (assetUrls.has(item[field])) {
              item[target] = assetUrls.get(item[field]);
              continue;
            }
            const blob = await this.gateway.loadAssets(item[field]);
            this.guard();
            const url = this.win.URL.createObjectURL(blob);
            urls.add(url);
            item[target] = url;
            assetUrls.set(item[field], url);
          }
        }
        this.releaseUrls();
        this.urls = urls;
        Object.defineProperty(deck, "_platformSession", { value: this, enumerable: false });
        this.cursor = batch.cursor;
        this.onBatch(deck, 0, this.generation);
      } catch (error) {
        for (const url of urls) this.win.URL.revokeObjectURL(url);
        throw error;
      }
    }
    prefetchNext() {
      if (this.reviewOnly) return;
      const batch = this.gateway.cache.get(this.cursor);
      if (batch?.nextCursor != null) this.gateway.loadBatch(batch.nextCursor, { prefetch: true }).catch(() => {
      });
    }
    async advance(callback) {
      this.guard();
      if (this.busy) return;
      this.busy = true;
      try {
        await this.gateway.loadBatch(this.cursor);
        this.guard();
        callback();
      } catch (error) {
        this.showError(error);
      } finally {
        this.busy = false;
      }
    }
    async nextBatch() {
      this.guard();
      if (this.busy) return;
      this.busy = true;
      try {
        const current = this.gateway.cache.get(this.cursor);
        if (current?.nextCursor == null) return;
        const batch = await this.gateway.loadBatch(current.nextCursor);
        await this.deliver(batch);
      } catch (error) {
        this.showError(error);
      } finally {
        this.busy = false;
      }
    }
    releaseUrls() {
      for (const url of this.urls) this.win.URL.revokeObjectURL(url);
      this.urls.clear();
    }
    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      this.win.clearInterval(this.clockTimer);
      this.unbind?.();
      this.gateway.dispose();
      this.releaseUrls();
      this.panel.remove();
    }
  };
  async function mountNativeCourse(options) {
    const session = new NativeCourseSession(options);
    try {
      await session.open();
    } catch (error) {
      session.showError(error);
    }
    return session;
  }
  async function mountNativeAssessment({ host, courseId, unitId, itemId, onSession, win = globalThis.window }) {
    const scope = () => JSON.stringify([win.AccountStorage.owner, win.AccountStorage.sessionEpoch, win.ChunkAPI.getBase(), win.ChunkAPI.getToken()]);
    const captured = scope(), doc = host.ownerDocument;
    let disposed = false;
    const guard = () => {
      if (disposed || scope() !== captured) throw Object.assign(new Error("SESSION_CHANGED"), { code: "SESSION_CHANGED" });
    };
    const panel = element(doc, "section", "", "course-access-panel"), status = element(doc, "p", "\u72EC\u7ACB\u6D4B\u8BC4 \xB7 \u8D44\u683C\u548C\u6743\u9650\u5C06\u5728\u5F00\u59CB\u65F6\u68C0\u67E5\u3002");
    const button = element(doc, "button", "\u5F00\u59CB\u6D4B\u8BC4\u8FD9\u4E00\u9879", "btn primary");
    panel.append(status, button);
    placeAccessPanel(host, panel);
    const url = new URL(win.location.href);
    const id = url.searchParams.get("assessmentId") || win.crypto.randomUUID();
    url.searchParams.set("assessmentId", id);
    win.history.replaceState({}, "", url);
    const client = new MembershipClient({ request: (path, options) => win.ChunkAPI.request(path, options) });
    const controller = new LearningSessionController({
      client: { start: (input) => client.startAssessment({ ...input, itemId, assessmentId: id }), action: (...args) => client.action(...args) },
      newRequestId: () => win.crypto.randomUUID(),
      captureScope: scope
    });
    const unbind = controller.bindVisibility(doc, win);
    const accept = async (remote) => {
      guard();
      const drafts = await win.IDBStore.listAssessmentDrafts();
      guard();
      const draft = drafts.find((row) => row.sessionId === id);
      const session = remote.session.status === "active" && draft?.data?.revision >= remote.session.revision ? draft.data : remote.session;
      button.hidden = true;
      status.textContent = session.status === "completed" ? "\u6D4B\u8BC4\u7ED3\u679C\u5DF2\u4FDD\u5B58\u3002" : "\u6D4B\u8BC4\u5DF2\u5F00\u59CB\uFF1B\u5DF2\u5B8C\u6210\u7B54\u6848\u4ECD\u4F1A\u4FDD\u5B58\u3002";
      await onSession(session, remote.result, draft?.metadata || {});
    };
    button.onclick = async () => {
      button.disabled = true;
      try {
        guard();
        const result = await controller.start({ courseId, unitId });
        await accept(result);
      } catch (error) {
        status.textContent = errorText(error);
      } finally {
        button.disabled = false;
      }
    };
    await win.LearningSessionBootstrap.ready();
    guard();
    try {
      await accept(await win.ChunkAPI.getAssessmentSession(id));
    } catch (error) {
      if (error.status !== 404) status.textContent = errorText(error);
    }
    return { dispose() {
      disposed = true;
      unbind();
      controller.pause().catch(() => {
      }).finally(() => controller.reset());
      panel.remove();
    } };
  }
  return __toCommonJS(membership_browser_entry_exports);
})();
