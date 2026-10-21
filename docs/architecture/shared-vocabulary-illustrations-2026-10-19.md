# Shared vocabulary illustrations

Course items keep their existing `images.wide` / `images.mobile` local references. `scripts/lib/vocabulary-illustrations.cjs` indexes verified WebP files and their source bindings; it is an image catalog alongside the existing vocabulary material library, not a second course or account database.

## Identity, review and reuse

- Asset identity is SHA-256 of the actual delivery bytes. Original artwork is not served as fallback. Each actual delivery must be a recognized 16:9 WebP, nonempty and strictly below 20,000 bytes.
- The catalog holds separate source course/unit/item bindings, headword, gloss, audience stage, style authority and review state. It checks report hashes/sizes against actual files and retains historical files. Identical byte files share an asset ID; semantically similar but different images stay separate.
- Review snapshots include unit directory ID, item ID, exact delivery path and hash. Only a matching source review with `status: pass` is eligible. Matching gloss/stage/style is conservative; target-scene compatibility still needs an explicit reviewed selection. Catalogs are build artifacts from trusted local reports/reviews, not untrusted upload input.
- `build`, `plan`, `apply`, and `export-oss` commands are in `scripts/vocabulary-illustrations.cjs`; each writes new output exclusively. `package-vocabulary-atlas.cjs --preflight` is the production entry before generation. Actual atlas packaging retains its existing standalone behavior for historical workflows; it does not magically prevent a user from bypassing preflight. The skill and AGENTS require preflight for future authoring.
- `apply` creates a new draft and never updates a published course. Existing curriculum revisions and learning records are unaffected. Previously generated alternate illustrations are preserved.

## Server configuration

The Express app and the isolated review server use `server/middleware/vocabulary-image-delivery.js`. Configuration is read once at service startup:

```powershell
$env:VOCAB_IMAGE_CATALOG='D:\06-project\chunk-practice\output\vocabulary-illustrations\catalog-20261019-v1.json'
# Leave this unset for local-file delivery.
$env:VOCAB_IMAGE_BASE_URL='https://images.example.com'
```

`images.example.com` is an example, not an active endpoint. Base URLs must use HTTPS without credentials, query or fragment. The configured catalog contains a whitelist of assets. Unlisted existing paths continue through the original server handling. Missing catalog with a configured base is a startup error. Review services may use a temporary isolated `IMAGE_REVIEW_PORT` for verification; do not restart the main live service for tests.

Request resolution:

1. An existing `assets/<word>.webp` alias returns a revalidatable redirect to `/_vocab-images/<sha256>.webp`.
2. Locally, the canonical path checks bytes/hash and serves that one file with `Cache-Control: public, max-age=31536000, immutable`, ETag, conditional 304 and HEAD support. A changed file cannot be served under an old hash.
3. In OSS mode, the canonical path redirects to `<base>/vocabulary/<sha256>.webp`. Set the object metadata from the upload manifest; the app cannot impose cache headers on OSS responses. Do not overwrite an existing hash key. A new image gets a new URL.

Different course aliases resolving to one hash therefore share the final browser cache entry within the same website/cache context. Different pictures with the same word do not share cache unless a reviewed new course actually references the same image. No precache, entire-library download, per-account cache or per-course query parameter is added. Private authenticated course-image caching in `src/learning/course-image-cache.mjs` has a different access model and remains unchanged.

The service worker lets vocabulary WebP aliases and canonical hash URLs use the browser HTTP cache directly, avoiding duplicate Cache API bodies per course alias and retention tied to application releases. Existing stored data is not explicitly cleared. This takes effect after the updated worker is installed; the local review service does not install that worker.

## OSS upload package

```powershell
node scripts/vocabulary-illustrations.cjs export-oss --catalog <catalog.json> --out <new-upload-directory>
```

This verifies the local source files then copies one file per content hash into `vocabulary/`, plus `upload-manifest.json` listing object keys, hashes, bytes, MIME and cache headers. It does not upload or require credentials. Retain local originals and delivery copies for publishing validation and recovery. Existing publication validators intentionally still verify local files; remote-only publication without the retained verification copies is not supported by this change.

Upload the package into the intended bucket, configure the fixed HTTPS image domain and verify response metadata/content hashes before enabling the base URL on the deployed service. If an upstream web server currently serves `/assets` directly, route the catalogued vocabulary aliases and `/_vocab-images/` through this middleware (or generate equivalent redirects); otherwise that server bypasses the resolver. Do not change auth or public access for unrelated/private resources.

## Review workflow

The review page retains all original localStorage keys. **保存审核快照到项目** sends existing marks to the localhost review service; source IDs/path/hash are checked before writing a new snapshot. Each snapshot is additive, with no account or course writes. Downloaded JSON remains available. Rebuild the catalog with an explicitly selected latest snapshot (or ordered snapshot list) to use new approvals. An `issue` mark prevents eligibility in that binding; previous catalogs are immutable audit artifacts and must be superseded for new work.

## Validation

`node --test scripts/vocabulary-illustrations.test.cjs` verifies source/hash binding, deduplication, sense/style/audience separation, draft preservation, local caching/304/HEAD, corrupted-file refusal and OSS resolution. Tests use temporary directories and isolated ephemeral ports, never the application database or original browser data.

## Initial artifacts (2026-10-19)

- Current catalog: `output/vocabulary-illustrations/catalog-20261019-v2.json` (3,754 bindings, 3,750 unique byte identities).
- Source review snapshot: `output/vocabulary-illustrations/reviews/review-1792374394061-d1bfa9bd.json` (1,300 existing user marks: 1,283 pass, 17 issue). Later browser marks require a new snapshot and catalog build.
- Upload package: `output/vocabulary-illustrations/oss-upload-20261019-v1/`, 3,750 objects and `upload-manifest.json`. Original images remain in place.
- Preflight example: `output/vocabulary-illustrations/unit8-preflight-20261019-v1.json`. It holds existing unreviewed matches for review rather than approving them.
- Local review service at port 4188 is configured with the current catalog and local hash delivery. The main service and production OSS configuration have not been restarted/deployed by this work. No courses were published and no original images were deleted or course references rewritten.
