# 九年级全一册课程包与本机原始 PNG 分离

- Status: complete
- Updated: 2026-10-21
- Source revision: E:/chunk-practice-assets/textbooks/pep-junior-grade9-full-2013/revisions/20261021-v4
- Executor workspace: D:/06-project/chunk-practice

## Goal and assumptions

The owner authorized keeping source PNGs on this machine without adding them to Git. Create a small, independently verifiable course package for review/delivery, and a separately verifiable local PNG archive for tracing, recropping, and future structured extraction. Keep v4 and all source files intact. Do not push to GitHub or upload to OSS.

## Outputs

- Git candidate: E:/chunk-practice-assets/textbooks/pep-junior-grade9-full-2013/revisions/20261021-v5
- Local-only source archive, outside the Git worktree: E:/chunk-practice-asset-sources/textbooks/pep-junior-grade9-full-2013/revisions/20261021-local-v1
- Local Git ignore rules exclude earlier and full archive revisions v1-v4 and failed package staging; v5 remains visible for intentional review/staging.

## Results

- v5 is 14,689,822 bytes on disk and contains zero PNG files. The delivery assets are 627 WebP files totaling 8,789,600 bytes. It contains 14 units and 628 items, 619 nonempty phonetics (597 confirmed, 22 pending review, 9 deferred), and no audio yet.
- The local source archive contains all 774 PNG files, 733,668,676 bytes. Each file retains its package-relative path, original source path(s), role, byte length, and SHA-256. The local manifest SHA-256 is 0b2950bbc8ebc46990b743c054872eee28ee1d68554d171d73208522abd8c080; v5 pins this digest.
- v5 package-only verification succeeded with 1,068 checksum entries and 14,469,141 listed bytes. verify-local succeeded for all 774 PNGs and confirmed the package-pinned manifest digest.
- The source fingerprint remains f7fc4e77211008dec98d48fb86e88230a539f088867b9627aeb8d7c497418ac1. v4 remains the original full archive and is excluded from Git by local repository ignore rules.
- Read-only package review is available from port 4192. The earlier 4189 and 4191 services were not replaced.

## Reproduction

    node scripts/textbook-asset-package.cjs split --source-package "E:/chunk-practice-assets/textbooks/pep-junior-grade9-full-2013/revisions/20261021-v4" --package-out "E:/chunk-practice-assets/textbooks/pep-junior-grade9-full-2013/revisions/20261021-v5" --originals-out "E:/chunk-practice-asset-sources/textbooks/pep-junior-grade9-full-2013/revisions/20261021-local-v1"
    node scripts/textbook-asset-package.cjs verify --package "E:/chunk-practice-assets/textbooks/pep-junior-grade9-full-2013/revisions/20261021-v5"
    node scripts/textbook-asset-package.cjs verify-local --package "E:/chunk-practice-assets/textbooks/pep-junior-grade9-full-2013/revisions/20261021-v5" --originals "E:/chunk-practice-asset-sources/textbooks/pep-junior-grade9-full-2013/revisions/20261021-local-v1"

Both outputs are create-only; rerunning against an existing destination fails rather than overwriting it. The local source archive is one copy on the same E: drive, not a second-device backup.
