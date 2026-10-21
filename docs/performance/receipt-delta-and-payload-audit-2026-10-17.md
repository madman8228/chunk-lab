# Receipt delta reuse and synchronization payload audit — 2026-10-17

## Outcome

Two confirmed sources of redundant downlink are removed without changing answer timing, idempotency or durable learning evidence:

1. The existing write receipt already includes a canonical `changes` snapshot produced inside the operation's SQLite transaction (`readChanges(userId, seq)` uses `buildMemSnapshot(userId, seq - 1)`). The browser previously ignored it and fetched substantially the same delta again. It now applies that receipt at the exact preceding local watermark, using the existing merge and atomic cache/ACK retirement machinery.
2. `learning.answer` receipts include the full sentence stat both in `operation.stat` and `changes.mem.stats.bySentence[key]`. A new explicit Accept capability (`application/vnd.chunklab.delta-receipt+json`) omits the former only when the canonical latter exists at the same seq. Old HTTP clients, stored receipt JSON, operations service return values, and GET receipt recovery retain the original shape. New clients work with an older server, which simply returns the original larger receipt.

No new synchronization write protocol, new snapshot schema, caching TTL, event deletion, history truncation, delayed save batch, or dependency introduced.

## Safety boundaries

- ACK persisted before applying a receipt; operations retire only in the existing atomic IndexedDB cache transaction.
- Local watermark exactly `receipt.seq - 1`: apply canonical delta, without GET.
- Local watermark already covers receipt: compare-and-swap current cache without rolling back, retiring covered ACKs atomically.
- Missing baseline, sequence gap, unsupported/malformed receipt, CAS race, or local application failure: use the existing downlink/refresh-through path.
- Account/base changes reject application. Session changes are not swallowed as a generic retry.
- Concurrent-device writes missed by the local baseline force a covering GET; a single-operation receipt never advances past an unseen gap.
- Reload recovery of already-ACKed pending rows retains its existing downlink path.
- Persistent local storage failure still retains ACKs across reload. Its test fixture now fails both receipt application and GET application until reload; a one-shot error is correctly healed by fallback.

## Measured payloads (synthetic fixtures; decimal bytes, decoded JSON)

### Real browser: three typing answers

Before this change, one earlier run observed 4 operation POSTs and 4 snapshot GETs. Operation counts vary with the existing debounced resume tail; this is not a fixed 4-per-3 protocol.

After including the resume tail and waiting for an empty queue, the final run observed:

- 5 POSTs: `learning.answer`, `learning.resume`, `learning.answer`, `learning.resume`, `learning.answer`.
- **0 snapshot GETs**, 0 catalog reads and 0 hidden archive reads in the answer window.
- Operation upload bodies: **2,158 B** total.
- Operation response bodies: **8,628 B** decoded total.
- Receipt deltas already present in those responses: **7,471 B**; no second snapshot download for these deltas.
- No remaining duplicate `operation.stat` in opt-in responses.

In an earlier pre-compaction run, three answers/one resume uploaded 1,618 B, returned 7,848 B and included 5,630 B of canonical deltas that the old client would fetch again. Different operation-tail counts mean these two runs are not a valid percentage comparison of total bytes.

### Controlled same-question repetition

`server/sync-payload-budget.test.js` allocates a fresh database and server, stores one unrelated 200-item synthetic course, then submits 30 answers for a different synthetic sentence:

| Metric | First answer | 30th answer |
| --- | ---: | ---: |
| Answer upload body | 473 B | 474 B |
| Legacy full receipt | 2,624 B | 18,890 B |
| Canonical delta inside receipt | 1,803 B | 9,937 B |
| Duplicate `operation.stat` | 621 B | 8,751 B |
| Retained learning evidence entries | 1 | 30 |

Opt-in replay of the same 30th receipt is **10,148 B**; all 30 evidence entries remain. Stored historical receipt still contains the original full stat. The 30th compact replay includes the ordinary duplicate-request marker, so the byte subtraction is not exactly stat size.

These values are **not compressed wire sizes or billed traffic**, and do not predict production throughput. Response compression already exists; repeated JSON compresses well, so raw JSON percentage savings must not be claimed as bandwidth savings.

## What is and is not currently efficient

| Path | Finding / action |
| --- | --- |
| Normal correct-answer upload | One event with identity, version, outcome and chunk counts; no whole deck or full account snapshot. Controlled bodies stay below 1 KB. Retained. |
| Answer snapshot delta | Unrelated unchanged 200-item course is absent; only one sentence row and one new event returned. Not full-history `stats.events` on every answer. Retained. |
| POST delta followed by GET delta | Confirmed duplicate; removed for exact-contiguous receipt path. |
| `operation.stat` plus canonical stat | Confirmed duplicate; removed only for explicit new-client capability. |
| Same sentence's `learningV1.evidence` | Full evidence list grows with repeated practice, rather than being append-only on the wire. It drives mastery/scheduling/replay semantics; do not truncate or omit without a compatible projected/patch contract. Still an optimization candidate. |
| Wrong-answer upload | `buildReinforceEvidence` sends the affected question's merged row, including prompt/chunks/hints and retained history. Not the whole wrong book, but old data is repeated. Evidence history is capped at 20 events. Moving to an event-only server merge is a separate protocol/concurrency change. Not changed. |
| Stats base and generation map | Canonical deltas repeat statistics base (including daysLog) and the compact complete generation map. These support baseline reconstruction and resets; not safe to treat as meaningless. A field-level stats/control patch would require compatibility tests. Not changed. |
| Independent new device / missing local cache | Full baseline may include personal course content and full account history. Subsequent reads use `since`. Splitting content from archive startup may help large accounts, but is not a trivial deletion. |
| Wordbook practice | Item/state reads are scoped and item pages bounded; state carries revision/resume/concurrency checks. Summary and resume maps are small. No blind removal of post-save/state checks. |
| Images / public catalog / hidden stats | Previous persistent-image, in-flight catalog sharing and hidden-stats changes remain in place; regression tests pass. |
| Usage and permission checks | Small control traffic has a different purpose from content transport; it is not disabled to make request counts appear smaller. |
| Imports / exports / authoring | Explicit large content transfers are distinct from per-answer sync. Not silently omitted or deduplicated across different revisions. |

Conclusion: the incremental architecture is appropriate, but not globally optimal. The highest-confidence duplication identified here is fixed; long-lived per-question evidence and mistake-row repetition remain meaningful, higher-risk future work. Network compaction does not reduce the database space occupied by historical full receipts.

## Verification and deployment state

- Unit tests: receipt exact-baseline/covered-ACK/gap/CAS/account checks, immutable compact format and legacy compatibility, durable queue, API behavior, original operation semantics, full/delta/tombstone snapshot contract.
- Isolated real-browser receipt tests: no GET in normal path, remote gap fallback, old response fallback, one-time local write failure fallback, reload and duplicate ACK retirement.
- Original isolated server-store queue recovery and server write-protocol persistence tests pass.
- Real-browser SW/learning flow: 28 checks pass, including authorized learning, offline denial and synthetic records retained after reconnection.
- Statistics request budget and persistent image-cache browser regressions pass.
- Browser SW hash regenerated and verified.

No real courses, learning records, archives, original browser storage, or backups changed. Servers used fresh temporary directories/ports. **The live service was not restarted:** client receipt reuse takes effect with the new frontend; opt-in compact responses additionally require deploying/restarting the updated server route through the normal release process.
