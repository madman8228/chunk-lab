# Structured textbook metadata and shared cards

## Canonical data

Use the existing `book.catalog.facets` / public-resource `facets` contract. No second card-title table or publisher-name inference service is introduced.

| Field | Meaning | Example |
|---|---|---|
| publisherId | Existing publisher identity/full name | 人民教育出版社 |
| seriesId | Existing textbook series | 人教版英语 |
| textbookVersion | Verified textbook-version short label | 人教版 |
| edition | Edition/year, not a content hash | 2024 |
| grades | Explicit grade classification | 七年级 |
| volume | Exact volume name | 下册 / 全一册 / 必修 第一册 |

Full course titles remain authoritative for details, search, accessible names and management. Card titles are derived, not persisted: with a verified version label, one grade, volume and edition, show the grade + volume + edition. Otherwise retain the original title. Never strip words with regex or infer versions from titles.

## Presentation

The shared content-card component handles discovery and personal-content shelves identically. The version badge goes upper left; learning-content kind remains upper right. Long badges truncate without overlap; tooltips retain full version/publisher information. The full course name remains the link's accessible name. Ordinary courses and incomplete legacy metadata retain existing titles. The garden/card style remains unchanged.

## Production and validation

- Grade 7 and current Grade 8 package generators explicitly supply the verified version label separately from publisher and edition.
- The contract accepts the optional scalar field, preserving older immutable packages.
- Whole-textbook assembly compares version labels across the book and every unit draft to prevent mixed editions.
- Authoring profiles support the verified label and reject malformed values. Course identity calculation excludes this display label: adding it cannot create a new course ID.
- AI authoring instructions request the distinction and prohibit guessing. The admin metadata form provides a separate scalar input.
- Workspace normalization, grouping, search, URL filters and facet options preserve the field. The misleading publisher label “版本” is corrected to “出版社”.
- Future textbook production must supply verified metadata. Missing legacy labels remain unknown until reviewed; there is no title-based fallback.

## Safe publication

Catalog-only revisions use the existing immutable release system. They cannot change any non-catalog book data, including unit titles, IDs, membership/order, item references and content/structure revisions. They cannot be combined with teaching-content or unit-title corrections. Review state records before/after catalog values.

Historical learning-scope resolution ignores catalog presentation differences only after verifying unchanged teaching content and membership. Adding a badge therefore cannot invalidate an older verified title-only URL. The authorization rule for title revisions itself remains strict.

The one-time `scripts/publish-textbook-version-metadata.cjs` operation targets the displayed PEP textbooks: Grade 7 upper/lower 2024, Grade 8 upper/lower 2024 and Grade 9 full 2013. The newly published Grade 8 lower book was discovered during final read-only verification and added after checking its source document. This explicit migration list is not a runtime course-ID lookup. It verifies source documents and existing publisher/series, rehearses in a new temporary directory, and requires `--apply` for real publication. Before activation it verifies publication-file backups, makes a consistent SQLite backup and checks its integrity, then verifies base releases. Old releases, assets and learning records remain preserved. Retired pilot books are excluded.

## Verification

Targeted tests cover shared cards at 1043/390px, multiple publishers, whole-volume naming, long badges, legacy/non-textbook fallback, accessible full names, cross-page consistency, identity stability, unchanged learning records, historical links after metadata correction, mixed-revision rejection, package generation/import and generated-bundle consistency.

This is not a full-suite pass. The design detector reported advisory differences between existing compact card values and the broader DESIGN.md token scale; the existing visual treatment was deliberately preserved.

## Live delivery

Five textbook metadata-only revisions were activated on 2026-10-22. Their 2,502 items, unit directories, item content hashes, structure hashes and original full names were preserved. Publication does not modify account learning rows. Backups include verified publication-file copies and consistent SQLite snapshots with successful integrity checks:

- `server/backups/textbook-version-2026-10-22T08-48-01-200Z` (first four books).
- `server/backups/textbook-version-2026-10-22T08-50-24-584Z` (new Grade 8 lower book).

Per-book base/release IDs and source hashes are recorded in each backup's manifest/result files. Service deployment PID: 29896 at handoff. The live `/api/library` response was verified to carry `人教版` for all five displayed textbooks. The original Grade 7 lower Unit 1 URL with its pre-title-correction structure revision still returns HTTP 200 after the catalog revisions.

Targeted test commands passed: content-card metadata, existing content-card consistency, textbook profile identity, workspace/discovery facets, vocabulary course contract, title/catalog publication regression, existing publisher/import tests, production package, authoring model/prompt, wordbook draft, library catalog, generated outputs, deploy dependency coverage, SW policy/hash/install budget, and the real-worker offline learning regression. Original browser storage and real account records were not used for tests.
