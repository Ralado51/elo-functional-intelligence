# Hackathon evidence checklist

All execution evidence below starts **NOT VERIFIED**. This checklist supplies acceptance criteria; it records no successful live run. Attach sanitized artifacts and exact SHA/time when completed. Never include secrets or real patient data.

| Check | Required evidence / acceptance | Status |
|---|---|---|
| Integrated source | Main/integrated SHA, PR dependencies and CI URLs; PR #19 source inspected at 0e47e12884d9287224ed9c8e652c0b27f89e602e | NOT VERIFIED |
| Production artifacts | Backend/frontend image digest and build/run link; no mutable-tag-only provenance | NOT VERIFIED |
| Access boundary | HTTPS; anonymous audience access challenged; anonymous GET and POST /api blocked; no public direct API/web/PostgreSQL ports; operator write path private/authenticated | NOT VERIFIED |
| PostgreSQL migrations | Disposable isolated database, migration output, resulting head and successful API persistence after restart | NOT VERIFIED |
| Deterministic backend tests | Command, SHA, exit status and actual test summary; identify patched/mocked AMD tests explicitly | NOT VERIFIED |
| Frontend tests/build | Commands, SHA, exit status and actual summaries | NOT VERIFIED |
| Container/proxy smoke | Images start, / and /api/health succeed, synthetic POST works privately, API recreation recovers; no audience mutation access | NOT VERIFIED |
| Synthetic fixture | New isolated DB, 40-minute sessions, synthetic patient linked to case, professional in same organization | NOT VERIFIED |
| Real AMD extraction | Fresh draft session with no existing observations; sanitized request/response and operator observation of successful upstream request at recorded time; pending persisted outputs and verbatim excerpts | NOT VERIFIED |
| Failure rollback | Deliberate mocked failure in isolated tests leaves draft unchanged with no observations/events; never deliberately break the live service | NOT VERIFIED |
| Human review | Approve/correct/reject example evidence with original/final values, reviewer reference and one event per decision; identify manual fixtures separately from AMD candidates | NOT VERIFIED |
| Immutability guards | Re-review returns 409, no extra event; approved session unchanged after pending observation review; no re-extraction/re-approval | NOT VERIFIED |
| Preview and consolidation | Pending blocks eligibility; accepted-only content; rejected excluded; linked patient; zero pending; synthetic draft disclaimer and source/audit IDs | NOT VERIFIED |
| Dashboards | Operations/Functional/Governance agree with persisted evidence; no clinical improvement claim | NOT VERIFIED |
| AMD telemetry | Persisted provider/model/run/token/latency/cost evidence if available; otherwise display unavailable, never infer historical metrics | UNAVAILABLE UNTIL EVIDENCED |
| Demo rehearsal | Timestamp, exact source/image, browser errors, outcome and labeled fallback record | NOT VERIFIED |

## Evidence record template

- Check:
- Verification timestamp/timezone:
- Application SHA and image digest:
- Environment and isolated database identifier (no connection secrets):
- Command or UI/API steps:
- Actual result / exit status:
- Sanitized artifact or CI link:
- Provenance: LIVE AMD / MOCKED TEST / MANUAL SYNTHETIC FIXTURE / SOURCE INSPECTION
- Limitations and unresolved blockers:

Do not copy test counts from a PR description as newly executed evidence. CI logs verified for an exact SHA may be cited as CI evidence with their URL. Do not claim mock fixtures represent AMD performance. Retain failed attempts and their provenance; do not delete or overwrite audit history to improve the demonstration.
