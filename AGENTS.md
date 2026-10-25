# Course asset protection

The owner has explicitly identified imported courses as irreplaceable assets.

- Do not delete, clear, reset, replace, or overwrite real course content, account learning records, original browser data, or backups without the owner's explicit authorization for the exact action and target.
- A missing course in the UI is not evidence of deletion. First inspect account ownership, filters, confirmed cache, server configuration, and the actual stored rows using read-only checks. Never clear storage or a database to fix a display problem.
- Persistence and migration tests must use a newly allocated temporary data directory and isolated port. Never point test processes at `server/data`, the running application's data directory, or a user-supplied course archive directory.
- Preserve archives and original records during refactors. Recovery must not replace a nonempty account with a whole snapshot; keep transactional empty-account checks and failure rollback.
- Before any authorized real data migration or overwrite, create a verified recoverable backup and record the target database and account. Do not copy only the main SQLite file while WAL writes are active; use a consistent SQLite backup mechanism.
- Do not restart or switch the live service merely to run a test. Verify changes on isolated instances first and state clearly whether the live service has been updated.
- Preserve unrelated worktree changes. Removing obsolete code does not authorize removal of course packages, generated course content, databases, or backups.
- All courses the owner publishes are system-built-in courses, never courses owned by or published to an individual account. Interpret “publish this course” as publishing it into the system-wide built-in course catalog; do not ask for an account target. This does not authorize account enrollment, account-specific import/save, or learning-record changes, which remain separate actions requiring explicit authorization.

# Vocabulary illustration size standard

The owner expects more than 10,000 vocabulary words. Image size is a hard product constraint.

- On 2026-10-12 the owner confirmed the latest unified limit: browser-facing vocabulary illustrations must be strictly smaller than 20,000 bytes (decimal 20 KB), including each fallback or alternative format. This supersedes the former 10 KB default and introduction-only exception. Smaller existing encodings may remain; prefer clearer encodings within the limit. Check each actual file size, not an atlas average.
- Load illustrations on demand for the current learning content; do not download or precache the entire vocabulary image library. Reuse cached images when revisiting a word.
- Retain original artwork separately; never serve a large original as an automatic fallback. Compression does not authorize deleting originals or course assets.
- Preserve recognizable teaching actions and objects within this budget. Adjust resolution, format, quality, or illustration complexity instead of silently raising the limit.
- New image-generation and delivery workflows must enforce this size budget before accepting browser-facing vocabulary assets. This limit applies to vocabulary illustrations, not unrelated page backgrounds or course covers.
- On 2026-10-15 the owner approved one shared 16:9 WebP delivery file per word for future production. Do not generate an AVIF alternative or a dedicated mobile crop by default. Display the complete image responsively on desktop and mobile. In the existing schema, `images.wide` and `images.mobile` both reference that same WebP path; count unique paths as delivery files. Preserve existing courses and their legacy assets; this policy does not authorize deleting or migrating them.

# Textbook wordbook authoring rules

- Before any new illustration is generated, build/search the shared illustration catalog and run `package-vocabulary-atlas.cjs --preflight` for the exact batch manifest. The later atlas packaging command must use that same catalog and plan; it recomputes the plan and blocks if any item has an existing approved image or requires candidate review. A matching spelling alone is insufficient. Exact word-and-gloss matches across grades, stages, or approved styles may be considered for global reuse, but only after a hash-bound `pass` review and explicit visual confirmation that the selected image suits every target course in the reuse group. Never auto-merge cross-stage/style candidates; keep uncertain or unsuitable scenes distinct. This policy follows the owner's 2026-10-22 objective to make illustrations reusable across Grades 3–9 courses.
- Course image references remain stable local asset keys. Shared delivery resolves those keys to immutable content-hash URLs, optionally backed by OSS/CDN. Do not embed signed, user-specific, course-specific or changing query parameters in shared image URLs. Do not alter published course references or remove legacy images as part of catalog building. OSS export produces a local upload package; uploading and changing production configuration are separate deployment actions.

- Treat a textbook wordbook as an auditable draft workflow. Confirm the exact publisher, title, edition/year, volume, unit, and requested source pages before describing or packaging it. Preserve labels such as “全一册”; do not infer “上册/下册” from grade or unit number.
- Use the supplied vocabulary pages as the source of truth. Distinguish textbook vocabulary pages from an alphabetical index; do not add index auditing unless the user asks for it or a specific discrepancy makes it necessary. Preserve split-line names as one complete entry and record textbook page references separately from scan/index page numbers.
- Clearly separate transcribed textbook headwords/glosses from newly authored examples, translations, and scenes. Never present newly written examples as textbook quotations. Reconcile item count and identity against the supplied source before review.
- Keep work in a separate, reviewable draft. A draft or preview is not approval to publish; publish into the system-wide built-in course catalog only after the owner explicitly approves publication and the release checks pass. Do not perform account-specific import/save, enrollment, or learning-record changes unless the owner explicitly authorizes those exact actions.
- Require explicit user review at the agreed content checkpoints; record what is approved and what remains pending. Preserve existing drafts, original scans, generated masters, and unrelated worktree changes. Version new assets instead of overwriting existing ones.
- Follow the vocabulary illustration size, lazy-loading, original-art preservation, and fallback rules above for every new delivery asset and alternative format.
- For ordinary textbook illustrations, the owner approved four-panel 2×2 generation followed by local cropping. Bind every panel to its exact word, item ID, position, and unique filename slug before generation; verify the mapping visually before applying draft references. Use individual generation for difficult scenes or failed panels.
- Keep the approved original style reference recorded in the batch manifest. For the current Grade 9 course, use the Unit 1 campus original `ref/words-pic/split/masters/connect-with-v2.png`; later generated batches are not replacement style authorities.



## 渐进搭句教学规则

- 创建、修改、审查渐进搭句课程、数据结构或学习交互前，必须完整阅读 `docs/curriculum/progressive-sentence-building-rules.md`，并以其中用户已确认规则为依据。
- 核心为“按语义拆分，逐词搭建，逐层合成”：局部单练、片段合并、信息扩展和句式变换须显式编排；不得机械地每一步都重拼更长的整句。
- 课程须逐渐覆盖句法成分（主谓宾、表语、定语、状语、补语、双宾语）、时态/体/语态、词组及句型。词性和句法作用分开，句法标注绑定当前表达与词范围；一次选词正确不能认定独立掌握。
- 该文件是教学规范；当前预览未实现的能力须明确标注，不能用现有前端限制代替教学规则。
- 渐进搭句的知识覆盖、先修关系及后续编课规划参照 `docs/curriculum/progressive-sentence-building-map.md`；区分已确认教学规则、待审阅知识地图、已实现预览与正式发布课程，不能混称完成。

## 强制规则:
- 编码前先思考(ThinkBefore Coding)明确陈述假设;不确定的地方要提问而不是靠猜;存在歧义时提供多种解释;如果存在更简单的方法，要予以反驳。
- 简约至上(Simplicity First)只写能解决问题的最少代码;不写投机性功能;不为单次使用的代码做抽象。
- 外科手术式修改(Surgical Changes)只触碰必须修改的地方;不要顺便“优化”无关的代码、注释或格式;不修复没坏的东西;匹配现有风格。
- 修复Bug后要给出系统性已经，避免针对系统性解决的问题，总是一次性的修修补补

## 问题处理与系统性优先原则

这条原则应默认适用于当前项目中的排障、需求分析、协议评估、联调适配，也适合作为后续项目或其他大模型协作时的通用规则复用。

### 默认工作方式

1. 先分析问题，再决定是否改代码，不接受“看到表象就直接补前端逻辑”的默认动作。
2. 先给出系统性建议，优先判断问题属于哪一层：前端、后端、设备端、数据侧、配置侧、流程侧。
3. 如果从系统整体看，由其他端处理更合理、成本更低、长期收益更高，应先明确提出该建议。
4. 当结论是“更适合由其他端解决”时，默认只输出分析和建议，不继续做前端兜底，不额外堆兼容逻辑，不制造掩盖根因的临时补丁。
5. 只有在用户明确要求“先前端兼容”“先临时兜底”或存在必须立即止血的业务约束时，才进入补丁方案，并必须标注其临时性、代价和后续收敛方向。

### 输出要求

遇到这类问题时，优先按下面结构输出：

1. 现象
2. 根因分析
3. 系统性建议
4. 更适合在哪一端解决
5. 是否需要当前前端继续兜底
6. 列出方案的好处和代价

### 禁止的默认行为

- 不要在根因未明确前直接改代码
- 不要把“前端能兼容”当作“前端应该兼容”
- 不要在明知其他端更适合修复时，继续替其他端兜底
- 不要用局部补丁掩盖系统问题，导致同类问题反复出现
