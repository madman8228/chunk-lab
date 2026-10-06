function copy(value) { return JSON.parse(JSON.stringify(value)); }

export class ExistingCourseGateway {
  constructor({ getWindow = () => globalThis.window, scopeGuard }) { this.getWindow = getWindow; this.scopeGuard = scopeGuard; }

  #ready(scope) {
    const win = this.getWindow();
    if (!win || !win.CL || !win.ChunkCourse || !win.AccountStorage) throw new Error('课程库尚未就绪，请刷新页面后重试。');
    win.AccountStorage.assertCurrent(); this.scopeGuard.assert(scope);
    return win;
  }

  async loadExample(catalogCourseId, scope) {
    const win = this.#ready(scope);
    const manifest = win.ContentRepo && win.ContentRepo.getManifest ? win.ContentRepo.getManifest() : null;
    const catalog = win.CourseCatalog.buildCatalog({ manifest: manifest || { decks: [] }, userDecks: win.CL.allDecks(win.CL.loadMem()), storyPackages: win.CL.readCourses(), logicalCourses: win.LogicalCourseStore.read() });
    const course = win.CourseCatalog.getCourse(catalog, catalogCourseId);
    if (!course) return null;
    const lesson = win.CourseCatalog.listLessons(course).find((item) => item.available !== false);
    if (!lesson || !lesson.contentRef) return null;
    let items = [], sourceRoles = [], sourceImages = [];
    if (lesson.contentRef.type === 'story-package') {
      const packageCourse = win.CL.readCourses().find((item) => item.courseId === lesson.contentRef.id);
      if (packageCourse && packageCourse.schemaVersion === '2.0') {
        sourceRoles = packageCourse.roles || [];
        const notes = packageCourse.authorNotes && packageCourse.authorNotes.chunklabImageText;
        if (notes && notes.format === 'chunklab-ai-image-text' && notes.formatVersion === '1.0') sourceImages = (notes.images || []).slice(0, 12).map(({ key, alt, prompt }) => ({ key, alt: String(alt || '').slice(0, 200), prompt: String(prompt || '').slice(0, 500) }));
        const map = new Map(packageCourse.utterances.map((item) => [item.id, item]));
        items = packageCourse.sequence.slice(0, 3).map((id) => map.get(id)).filter(Boolean).map((item) => ({ en: item.text.en, zh: item.text['zh-CN'], ...(item.roleId ? { role: item.roleId } : {}), chunks: item.chunks && item.chunks.correctOrder.map((id) => item.chunks.items.find((chunk) => chunk.id === id)).filter(Boolean).map((chunk) => chunk.text.trim()) }));
      }
    } else if (lesson.contentRef.type === 'sentence-deck') {
      const index = await win.ContentRepo.ensureDeckIndex(lesson.contentRef.id, win.CL.loadMem());
      this.scopeGuard.assert(scope);
      const records = await win.ContentRepo.hydrateItems((index.items || []).slice(0, 3), { memory: false });
      this.scopeGuard.assert(scope);
      items = records.map((item) => ({ en: item.sentence, zh: item.translation || '', chunks: Array.isArray(item.chunks) ? item.chunks.slice(0, 20) : undefined })).filter((item) => item.zh);
    }
    if (!items.length) throw new Error('这门课程暂时没有可供 AI 定制的样例内容。');
    const roleIds = new Set(items.map((item) => item.role).filter(Boolean));
    const contentForm = roleIds.size >= 2 && items.every((item) => item.role) ? 'dialogue' : items.some((item) => item.chunks) ? 'article' : 'sentences';
    const roles = contentForm === 'dialogue' ? sourceRoles.filter((role) => roleIds.has(role.id)).map((role) => ({ key: role.id, name: role.name })) : [];
    return { title: course.title, contentForm, roles, items, ...(sourceImages.length ? { images: sourceImages } : {}) };
  }

  async loadLegacyAiCourse(courseId, scope) {
    const win = this.#ready(scope); await win.CL.preload(); this.scopeGuard.assert(scope);
    const course = win.CL.readCourses().find((item) => item.courseId === courseId);
    const progress = win.CL.readProgress()[courseId] || null;
    return course ? { course: copy(course), progress: progress ? copy(progress) : null } : null;
  }

  async findCreatedCourse(courseId, scope) {
    const win = this.#ready(scope); await win.CL.preload(); this.scopeGuard.assert(scope);
    const course = win.CL.readCourses().find((item) => item.courseId === courseId);
    return course ? copy(course) : null;
  }

  async getLaunchReceipt(deckId, scope) {
    const win = this.#ready(scope); await win.CL.preload(); this.scopeGuard.assert(scope);
    const story = win.CL.readCourses().find((item) => item.courseId === deckId);
    if (story) return { storageKind: 'story-package', contentId: story.courseId, catalogCourseId: `package:${story.courseId}`, lessonId: `lesson:story-package:${story.courseId}` };
    const deck = win.CL.findDeck(win.CL.loadMem(), deckId);
    if (!deck || !deck.authoring || deck.authoring.template !== 'sentence-practice') throw new Error('找不到已保存的 AI 句子课程。');
    const catalogCourseId = deck.authoring.catalogCourseId || `user-deck:${deck.id}`;
    return { storageKind: 'sentence-deck', contentId: deck.id, catalogCourseId, lessonId: `lesson:user-deck:${deck.id}` };
  }

  async findNativeCourse(deckId, scope) {
    const win = this.#ready(scope); await win.CL.preload(); this.scopeGuard.assert(scope);
    const deck = win.CL.findDeck(win.CL.loadMem(), deckId);
    return deck ? copy(deck) : null;
  }

  async saveSentenceCourse(deck, scope, { forceSave = false, adoptMetadata = false, beforeSave = null } = {}) {
    const win = this.#ready(scope); await win.CL.preload(); this.scopeGuard.assert(scope);
    const mem = win.CL.loadMem();
    const cloudConfig = win.CL.getCloudConfig && win.CL.getCloudConfig();
    const protocol3 = !!(cloudConfig && cloudConfig.writeProtocol === 3);
    const originalDecks = (mem.decks || []).map(copy);
    const index = (mem.decks || []).findIndex((item) => item.id === deck.id);
    if (index >= 0) {
      const current = mem.decks[index];
      if (JSON.stringify(current) !== JSON.stringify(deck)) {
        const sameItems = JSON.stringify(current.items) === JSON.stringify(deck.items);
        const noLegacySource = !current.authoring || !current.authoring.legacySource;
        if (adoptMetadata && sameItems && noLegacySource) mem.decks[index] = { ...current, authoring: copy(deck.authoring) };
        else throw new Error('该课程 ID 已有不同内容，已保留原课程。请另建制作会话。');
      }
    }
    if (index < 0) mem.decks = (mem.decks || []).concat([copy(deck)]);
    if (index < 0 || forceSave) {
      const rollback = typeof beforeSave === 'function' ? beforeSave(mem) : null;
      if (protocol3) {
        let serverCommitted = false;
        try {
          if (!win.ServerCache || !win.ServerStore) throw new Error('课程保存服务尚未就绪，请刷新后重试。');
          const row = await win.ServerCache.read();
          if (!row || row.owner !== win.AccountStorage.owner) throw new Error('课程数据尚未从服务器确认；保存未提交。');
          const current = (row.snapshot.mem.decks || []).find((item) => item.id === deck.id);
          if (index >= 0 && !current) throw new Error('服务器课程已变化或删除；本次保存未覆盖服务器版本。');
          if (index < 0 && current) throw new Error('该课程编号已存在于服务器；本次保存未覆盖服务器版本。');
          const expectedRev = current ? row.snapshot.revs.decks[deck.id] : null;
          await win.ServerStore.submitCommitted('deck.put', { deck: copy(mem.decks.find((item) => item.id === deck.id)), ...(rollback ? { clearRetiredMarker: true } : {}) }, {
            requestId: `authoring-deck-put-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
            expectedRev
          });
          serverCommitted = true;
          this.scopeGuard.assert(scope);
          const confirmed = await win.ServerCache.read();
          if (!confirmed || confirmed.owner !== win.AccountStorage.owner) throw new Error('课程已提交，但确认状态暂不可用；请刷新查看结果。');
          const savedDeck = (confirmed.snapshot.mem.decks || []).find((item) => item.id === deck.id);
          if (!savedDeck) throw new Error('课程已提交，但服务器确认数据中暂未找到；请刷新查看结果。');
          const decks = (mem.decks || []).filter((item) => item.id !== deck.id);
          mem.decks = decks.concat([copy(savedDeck)]);
          if (typeof win.CL.saveAndNotify !== 'function') throw new Error('课程已保存到服务器，但本机显示状态未能更新；请刷新查看结果。');
          const projected = await win.CL.saveAndNotify(mem, 'local');
          if (projected === false) throw new Error('课程已保存到服务器，但本机显示状态未能更新；请刷新查看结果。');
        } catch (error) {
          if (!serverCommitted) {
            mem.decks = originalDecks;
            if (typeof rollback === 'function') { try { rollback(); } catch (restoreError) {} }
          }
          throw error;
        }
        return { storageKind: 'sentence-deck', contentId: deck.id,
          catalogCourseId: deck.authoring.catalogCourseId || `user-deck:${deck.id}`,
          lessonId: `lesson:user-deck:${deck.id}` };
      }
      let committed;
      try {
        committed = await win.CL.saveAndNotify(mem);
        this.scopeGuard.assert(scope);
      } catch (error) {
        if (typeof rollback === 'function') { try { rollback(); } catch (restoreError) {} }
        throw error;
      }
      if (!committed) {
        if (typeof rollback === 'function') { try { rollback(); } catch (restoreError) {} }
        throw new Error('课程尚未完成保存。请检查账号或本地存储状态后重试。');
      }
    }
    return { storageKind: 'sentence-deck', contentId: deck.id,
      catalogCourseId: deck.authoring.catalogCourseId || `user-deck:${deck.id}`,
      lessonId: `lesson:user-deck:${deck.id}` };
  }

  async saveCompiledCourse(course, assets, scope) {
    const win = this.#ready(scope); await win.CL.preload(); this.scopeGuard.assert(scope);
    const result = await win.ChunkCourse.importCourse(copy(course), copy(assets || {}), false);
    this.scopeGuard.assert(scope);
    if (!result || !result.course || result.course.courseId !== course.courseId) throw new Error('课程保存结果无法确认。请返回重试。');
    return { storageKind: 'story-package', contentId: course.courseId, catalogCourseId: `package:${course.courseId}`, lessonId: `lesson:story-package:${course.courseId}` };
  }

  async joinCourse(catalogCourseId, scope) {
    const win = this.#ready(scope);
    const storyPackages = win.ChunkCourse.readCourses ? win.ChunkCourse.readCourses() : win.CL.readCourses();
    const catalog = win.CourseCatalog.buildCatalog({ manifest: win.ContentRepo.getManifest(), userDecks: win.CL.allDecks(win.CL.loadMem()), storyPackages, logicalCourses: win.LogicalCourseStore.read() });
    const course = win.CourseCatalog.getCourse(catalog, catalogCourseId);
    if (!course || course.available === false) throw new Error('已保存课程，但课程目录暂时无法读取。');
    await win.CourseEnrollment.join(course.id, win.CourseCatalog.getEnrollmentAliases(catalog)); this.scopeGuard.assert(scope);
    return { courseId: course.id };
  }

  describePersistence(scope) {
    const win = this.#ready(scope);
    return win.CL.serverSaveState ? win.CL.serverSaveState() : { phase: 'ready' };
  }
}
