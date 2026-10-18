# AMD execution evidence and attribution limits

Evidence recorded for AMD Developer Hackathon ACT III, October 17, 2026. This document separates verified adapter behavior from user-provided account counters. No AMD request was made for this documentation task.

## User-provided provider-account counters

The user supplied the following observations from the provider dashboard. They were not independently retrieved by Codex. “Today” refers to the provider dashboard's October 17, 2026 view; its timezone and capture time are not supplied.

| Counter | All-time | Today — October 17, 2026 |
| --- | ---: | ---: |
| Requests | 6 | 1 |
| Errors | 0 | 0 |
| Total tokens | 2,088 | 603 |
| Prompt tokens | 914 | 264 |
| Completion tokens | 1,174 | 339 |
| Points consumed | 0.0005 | 0.0001 |

Arithmetic is consistent: 914 + 1,174 = 2,088 and 264 + 339 = 603. Today's usage is a subset of all-time usage; do not add the columns. Points are provider units, not an independently established currency cost.

**These are provider-account usage counters. They do not independently establish which specific requests produced the persisted observations in case OT-001. Do not claim all six requests were Elo extraction calls.** Zero account-reported errors is not proof of extraction accuracy, end-to-end application success or successful professional review.

No provider-dashboard screenshot/export containing these counters is committed with this change. No request IDs, precise request timestamps, latency, monetary cost, per-request model attribution or accuracy measurement were supplied. The dashboard counters alone cannot establish any of them.

## Verified integration flow in this checkout

Sources: [active AMD adapter](../backend/app/amd_inference.py), [FastAPI routes](../backend/app/main.py), [database layer](../backend/app/database.py), [review workflow](../backend/app/review.py).

1. `POST /sessions/{session_id}/extract` checks that the persisted session is a draft. AMD mode also refuses extraction when observations already exist, avoiding replacement of those records.
2. AMD mode requires `ELO_INFERENCE_MODE=amd` and `ELO_SYNTHETIC_ONLY_ACK=true`. The adapter requires a server-side `RADEON_API_KEY`. Mock mode instead produces a pending session with missing-information notices and no extracted candidate observations.
3. The adapter defaults to **DeepSeek-V4-Flash**, overridable through `RADEON_MODEL`. It accepts only the documented base `https://developer.amd.com.cn/radeon/api/v1` and POSTs to `/chat/completions`. This verifies the configured/default model, not which model served any particular historical account request.
4. The request contains synthetic notes, a no-invention/source-evidence system prompt, `response_format: json_object`, `reasoning_effort: none`, temperature 0 and `max_tokens: 900`. The HTTP client timeout is 90 seconds, **not measured inference latency**; the token ceiling is not actual usage.
5. The adapter reads `choices[0].message.content`, parses JSON with Pydantic and accepts at most 12 candidate observations. Each has functional domain, observation text and source excerpt; every excerpt must be an exact continuous substring of supplied notes. This is provenance checking, not semantic/clinical validation.
6. Provider/format/evidence failure returns an application error without saving an extraction. A successful result is persisted transactionally as pending observations and pending session extraction; concurrent session/observation checks protect existing data. It never automatically approves observations.
7. A registered synthetic professional in the linked patient's organization must explicitly approve/correct/reject each observation. Original evidence is retained alongside reviewed text/domain and append-only application audit events. Documentation/dashboard reads do not invoke inference.

The active adapter does **not** persist the provider response's usage, response/request ID, model attribution, elapsed latency or cost. `/health` derives mode from configuration/key presence; it does not call the provider and cannot certify a successful historical request. Governance marks unavailable telemetry explicitly. Separate provider transport/evidence modules and their tests must not be mistaken for the active route's recorded telemetry.

Root `.env.example` has legacy `AMD_*` placeholders. The active path above uses **`RADEON_*`**, as wired in the [deployment Compose](../deploy/portainer/compose.demo.yml). No key values belong in documentation, screenshots, frontend variables or Git history.

## Available verification and evidence gaps

Offline regression sources include [AMD API integration](../backend/tests/test_amd_api_integration.py), [adapter tests](../backend/tests/test_amd_inference.py) and [review tests](../backend/tests/test_observation_review.py). These substitute responses and failure paths; passing them is not a live provider benchmark. The [evidence index](HACKATHON_EVIDENCE_INDEX.md) links historical CI and synthetic UI captures.

The user reports four AMD-extracted OT-001 observations with four explicit human approvals and durable references. This documentation task did not query production or join account usage to those records. Attribution would require an appropriately redacted, securely obtained request-to-extraction mapping and deployment/model evidence; no IDs or timings are invented here. Any future live request, telemetry change or production evidence collection requires its own authorized scope. Do not rerun extraction merely to fill this gap or alter the existing demo records.
