# Textbook asset packages

Use a separate, private, versioned asset package for each textbook identity. The package is an auditable archive and authoring source; it does not replace a published course, update account learning records, or imply that assets have been uploaded to OSS.

## Identity and layout

- Keep publisher, exact title, edition/year, and volume in the book identity. Preserve labels such as “全一册”; do not infer a volume.
- Store each book under a stable book key, then create a new immutable revision for each approved archive state: `textbooks/<book-key>/revisions/<YYYYMMDD-vN>/`.
- Keep a package-local `manifest.json`, `checksums.json`, and README. Include source snapshots, vocabulary/item identities, phonetics and review status, delivery images, audio bindings/placeholders, and source provenance. Preserve original artwork in a companion source archive when it does not need Git distribution; bind it to the package with a SHA-256 manifest. Use a new revision instead of overwriting an existing one.
- Link every asset by stable item ID and content hash. Repeated spellings can represent distinct items; identical image bytes may be stored once and referenced by multiple items. Never infer reuse from spelling alone.
- Distinguish user-confirmed phonetics, pending review, and owner-deferred items. Keep audio text, locale, voice/version, and item ID bound together. An empty audio inventory means “not produced,” not “missing from a complete release.”
- State gaps explicitly. A hash manifest proves package integrity, not source correctness, review approval, or remote backup.
- Keep Git course packages self-contained for course review and delivery. If PNG scans, atlases, and masters are local-only, place them outside the Git worktree in a dedicated archive with its own manifest and checksums. The course manifest records the archive hash, byte and file totals, source paths, and item links. Provide package-only verification that needs no PNG files and optional local-original verification that checks the companion archive. Do not merely ignore PNGs while leaving them required by the package verifier.

## Build and verify

The package module is reusable, but source enumeration is textbook-specific. First provide or select an inventory adapter that reads the authoritative course draft and traces source scans, reports, masters, atlases, and style references. The current CLI adapter supports only `pep-junior-grade9-full-2013`; do not claim a new textbook is supported until its adapter and counts are checked.

From the project root, the supported Grade 9 flow is:

```powershell
node scripts/textbook-asset-package.cjs inventory --root "D:\\06-project\\chunk-practice" --book pep-junior-grade9-full-2013 --out "<new-inventory.json>"
node scripts/textbook-asset-package.cjs pack --root "D:\\06-project\\chunk-practice" --inventory "<inventory.json>" --out "<private-assets>\\textbooks\\<book-key>\\revisions\\<new-revision>"
node scripts/textbook-asset-package.cjs verify --package "<new-revision>"
```

For a full verified package that should be split into a Git course package and local-only PNG archive, create new output directories and run:

```powershell
node scripts/textbook-asset-package.cjs split --source-package "<full-package>" --package-out "<new-lean-revision>" --originals-out "<local-only-source-archive>"
node scripts/textbook-asset-package.cjs verify --package "<new-lean-revision>"
node scripts/textbook-asset-package.cjs verify-local --package "<new-lean-revision>" --originals "<local-only-source-archive>"
```

Use a fresh inventory and a never-before-used output directory. Verify the source fingerprint before and after packing. Never overwrite an existing revision. Failed staging folders are diagnostic records and should not be mistaken for complete packages.

Before accepting a package, verify counts and item identities against the source, check every manifest hash, confirm each vocabulary delivery image is 16:9 WebP strictly below 20,000 bytes, and confirm review classifications and gaps. Relocation testing must copy the package to a newly allocated temporary directory and run both `verify` and the read-only preview against that copy. Tests must not read or write live app data.

Keep private package integrity checks independent from the private repository's root manifest unless that root manifest is deliberately extended and reviewed. A local copy is not a remote backup; check Git LFS quota before any future push. OSS upload and production configuration are separate, explicitly authorized steps.
