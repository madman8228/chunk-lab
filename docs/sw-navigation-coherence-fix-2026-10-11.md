# Course-return boot failure

Symptom: `CourseEnrollment.deckMemberships is not a function` after course creation and return to the learning homepage.

Reproduced the release-mixing pattern with the real service-worker fetch handler: network-first navigation returns new HTML while cache-first scripts remain in the installed old bundle. The new page calls an API absent from the older module. This is a resource-delivery policy defect, not course-data loss.

Fix: application HTML in the atomic precache uses that installed bundle, just like scripts; query parameters do not bypass it. A complete new installation activates together. Non-application navigation keeps its existing behavior. Version-suffixed enrollment references bypass legacy workers' unversioned stale module; the new worker resolves these references to its canonical bundled copy, preserving offline use and release coherence.

Verification: `node scripts/sw-navigation-coherence.test.cjs` failed before the fix and passes after it. `node e2e/course-membership-review.test.js` passes using a newly allocated temporary data directory and isolated server port, including course membership and return navigation. No real course, browser-account storage, learning record or backup was cleared or migrated.
