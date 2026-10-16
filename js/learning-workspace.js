var LearningWorkspace = (() => {
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

  // scripts/learning-workspace-entry.mjs
  var learning_workspace_entry_exports = {};
  __export(learning_workspace_entry_exports, {
    FACET_LABELS: () => FACET_LABELS,
    TOOLS: () => TOOLS,
    buildHomeModel: () => buildHomeModel,
    canonicalResourceId: () => canonicalResourceId,
    collectPersonalResources: () => collectPersonalResources,
    facetOptions: () => facetOptions,
    filterResources: () => filterResources,
    groupTextbooks: () => groupTextbooks,
    normalizeResource: () => normalizeResource,
    resourceKindCounts: () => resourceKindCounts,
    resourcesFromCatalog: () => resourcesFromCatalog,
    safeCover: () => safeCover,
    selectTools: () => selectTools,
    selectionFromUrl: () => selectionFromUrl
  });

  // src/learning-workspace/resource-model.mjs
  var dimensions = ["audiences", "schoolStages", "grades", "levels", "goals", "topics", "exams"];
  var scalarFacets = ["seriesId", "publisherId", "edition", "volume"];
  var kinds = /* @__PURE__ */ new Set(["course", "wordbook", "textbook"]);
  var referenceTypes = /* @__PURE__ */ new Set(["sentence-deck", "story-package", "vocabulary-pilot", "vocabulary-book", "protected-course"]);
  var text = (value, max = 200) => typeof value === "string" ? value.trim().slice(0, max) : "";
  function safeCover(value) {
    const url = text(value, 1e3);
    if (!url || /[\\\u0000-\u001f]/.test(url) || url.split("/").includes("..")) return "";
    return /^(?:assets\/|\/assets\/)/.test(url) ? url : "";
  }
  function normalizeResource(source = {}) {
    const facets = {};
    for (const key of dimensions) facets[key] = [...new Set((Array.isArray(source.facets?.[key]) ? source.facets[key] : []).map((value) => text(value, 60)).filter(Boolean))].slice(0, 20);
    for (const key of scalarFacets) facets[key] = text(source.facets?.[key], 100) || null;
    const sourceRefs = (Array.isArray(source.sourceRefs) ? source.sourceRefs : []).filter((ref) => referenceTypes.has(ref?.type) && text(ref.id)).map((ref) => ({ type: ref.type, id: text(ref.id) }));
    const available = source.available !== false && sourceRefs.length > 0;
    const activities = available ? [...new Set(sourceRefs.map((ref) => ref.type === "vocabulary-pilot" || ref.type === "vocabulary-book" ? "vocabulary" : "chunks"))] : [];
    return {
      resourceId: text(source.resourceId),
      kind: kinds.has(source.kind) ? source.kind : "course",
      title: text(source.title),
      description: text(source.description, 1e3),
      coverUrl: safeCover(source.coverUrl),
      origin: ["builtin", "imported", "created"].includes(source.origin) ? source.origin : "builtin",
      visibility: source.visibility === "private" ? "private" : "public",
      sourceRefs,
      facets,
      activities,
      available,
      unavailableReason: available ? "" : text(source.unavailableReason) || "\u5185\u5BB9\u6682\u4E0D\u53EF\u7528",
      metadataRevision: Number.isSafeInteger(source.metadataRevision) ? source.metadataRevision : 0,
      courseId: text(source.courseId),
      accessLevel: source.accessLevel === "member" ? "member" : "free",
      relatedCourseIds: [...new Set((Array.isArray(source.relatedCourseIds) ? source.relatedCourseIds : []).map((value) => text(value, 200)).filter((value) => /^course:[a-zA-Z0-9:._-]{1,193}$/.test(value)))].slice(0, 20)
    };
  }
  function resourcesFromCatalog(catalog) {
    return (catalog?.courses || []).map((course) => normalizeResource({
      resourceId: "course:" + course.id,
      courseId: course.id,
      title: course.title,
      description: course.description,
      coverUrl: course.coverImage,
      origin: course.origin === "user" ? "imported" : "builtin",
      accessLevel: course.accessLevel,
      visibility: course.origin === "user" ? "private" : "public",
      available: course.available,
      sourceRefs: (course.lessons || []).filter((lesson) => lesson.available !== false).map((lesson) => lesson.contentRef).filter(Boolean)
    }));
  }
  function canonicalResourceId(id, aliases = {}) {
    if (!id.startsWith("course:")) return id;
    const courseId = id.slice(7);
    return "course:" + (aliases[courseId] || courseId);
  }
  function collectPersonalResources(resources, preferences, aliases = {}) {
    const byId = new Map(resources.map((resource) => [resource.resourceId, resource]));
    return Object.values(preferences || {}).filter((row) => row?.itemType === "resource" && row.selected).map((row) => {
      const id = canonicalResourceId(row.targetId, aliases);
      return { ...byId.get(id) || normalizeResource({ resourceId: row.targetId, title: "\u6682\u4E0D\u53EF\u7528\u7684\u5185\u5BB9", available: false }), savedTargetId: row.targetId };
    });
  }

  // src/learning-workspace/facets.mjs
  var FACET_LABELS = Object.freeze({
    audiences: "\u9002\u7528\u4EBA\u7FA4",
    schoolStages: "\u5B66\u6BB5",
    grades: "\u5E74\u7EA7",
    levels: "\u6C34\u5E73",
    goals: "\u5B66\u4E60\u76EE\u6807",
    topics: "\u9898\u6750",
    exams: "\u8003\u8BD5",
    seriesId: "\u7CFB\u5217",
    publisherId: "\u7248\u672C",
    edition: "\u7248\u6B21",
    volume: "\u518C\u6B21"
  });
  function values(resource, dimension) {
    const value = resource.facets?.[dimension];
    return Array.isArray(value) ? value : value ? [value] : [];
  }
  function filterResources(resources, selection = {}, omitDimension = "") {
    const query = String(selection.query || "").trim().toLocaleLowerCase();
    return resources.filter((resource) => {
      if (selection.kind && resource.kind !== selection.kind) return false;
      if (query && ![resource.title, resource.description, ...Object.values(resource.facets || {}).flat()].filter(Boolean).join(" ").toLocaleLowerCase().includes(query)) return false;
      return Object.keys(FACET_LABELS).every((dimension) => {
        if (dimension === omitDimension) return true;
        const wanted = selection[dimension];
        return !wanted?.length || wanted.some((value) => values(resource, dimension).includes(value));
      });
    });
  }
  function facetOptions(resources, selection = {}) {
    return Object.fromEntries(Object.keys(FACET_LABELS).map((dimension) => {
      const counts = /* @__PURE__ */ new Map();
      for (const resource of filterResources(resources, selection, dimension)) {
        for (const value of values(resource, dimension)) counts.set(value, (counts.get(value) || 0) + 1);
      }
      return [dimension, [...counts].sort((a, b) => a[0].localeCompare(b[0], "zh-CN")).map(([value, count]) => ({ value, count }))];
    }));
  }
  function selectionFromUrl(search) {
    const params = new URLSearchParams(search);
    const selection = { kind: ["course", "wordbook", "textbook"].includes(params.get("kind")) ? params.get("kind") : "", query: params.get("q") || "" };
    for (const key of Object.keys(FACET_LABELS)) selection[key] = params.getAll(key);
    return selection;
  }
  function resourceKindCounts(resources, selection = {}) {
    const counts = { all: 0, course: 0, wordbook: 0, textbook: 0 };
    const seen = /* @__PURE__ */ new Set();
    for (const resource of filterResources(resources, { ...selection, kind: "" })) {
      if (seen.has(resource.resourceId)) continue;
      seen.add(resource.resourceId);
      counts.all++;
      if (Object.hasOwn(counts, resource.kind)) counts[resource.kind]++;
    }
    return counts;
  }
  function groupTextbooks(resources) {
    const groups = /* @__PURE__ */ new Map();
    for (const resource of resources) {
      const key = resource.facets.seriesId ? JSON.stringify([resource.facets.seriesId, resource.facets.publisherId, resource.facets.edition]) : resource.resourceId;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(resource);
    }
    return [...groups.values()];
  }

  // src/learning-workspace/tools.mjs
  var TOOLS = Object.freeze([
    Object.freeze({ id: "vocabulary", label: "\u5B66\u5355\u8BCD", href: "vocabulary.html", readiness: "ready", resumeSupport: true, resumeScope: "wordbook" }),
    Object.freeze({ id: "chunks", label: "\u7EC3\u53E5\u5B50", href: "main.html?view=discover", readiness: "ready", resumeSupport: true })
  ]);
  function selectTools(preferences = {}) {
    const pinned = Object.values(preferences).filter((row) => row?.itemType === "tool" && row.selected).sort((a, b) => (a.position || 0) - (b.position || 0));
    const tools = pinned.map((row) => TOOLS.find((tool) => tool.id === row.targetId)).filter(Boolean);
    return { personalized: tools.length > 0, tools: tools.length ? tools.slice(0, 3) : TOOLS.slice() };
  }

  // src/learning-workspace/home-model.mjs
  function buildHomeModel({ resources = [], memberships = {}, preferences = {}, resume = null, due = 0, status = "ready" } = {}) {
    const joined = resources.filter((resource) => resource.courseId && memberships[resource.courseId]?.joined);
    joined.sort((a, b) => (memberships[b.courseId].changedAt || 0) - (memberships[a.courseId].changedAt || 0));
    return { status, resume, due: Math.max(0, Number(due) || 0), active: joined.slice(0, 3), ...selectTools(preferences) };
  }
  return __toCommonJS(learning_workspace_entry_exports);
})();
