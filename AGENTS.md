# Course asset protection

The owner has explicitly identified imported courses as irreplaceable assets.

- Do not delete, clear, reset, replace, or overwrite real course content, account learning records, original browser data, or backups without the owner's explicit authorization for the exact action and target.
- A missing course in the UI is not evidence of deletion. First inspect account ownership, filters, confirmed cache, server configuration, and the actual stored rows using read-only checks. Never clear storage or a database to fix a display problem.
- Persistence and migration tests must use a newly allocated temporary data directory and isolated port. Never point test processes at `server/data`, the running application's data directory, or a user-supplied course archive directory.
- Preserve archives and original records during refactors. Recovery must not replace a nonempty account with a whole snapshot; keep transactional empty-account checks and failure rollback.
- Before any authorized real data migration or overwrite, create a verified recoverable backup and record the target database and account. Do not copy only the main SQLite file while WAL writes are active; use a consistent SQLite backup mechanism.
- Do not restart or switch the live service merely to run a test. Verify changes on isolated instances first and state clearly whether the live service has been updated.
- Preserve unrelated worktree changes. Removing obsolete code does not authorize removal of course packages, generated course content, databases, or backups.
