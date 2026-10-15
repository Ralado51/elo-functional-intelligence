# Sprint 4 — Evidence-first extraction contract (phase A)

This phase prepares the application for an AMD provider **without guessing the Token Factory API contract**.

## Implemented

- Provider-neutral `EvidenceObservation`, `EvidenceExtraction` and `EvidenceAssessment` Pydantic schemas.
- Fixed categories: participation, communication, motor, sensory, autonomy, other.
- Exact substring evidence validation against source session notes.
- Unsupported evidence indices are reported instead of being silently accepted.
- Configuration schema requiring an HTTPS endpoint, model identifier and API key; the key is excluded from serialized settings.
- Unit tests requiring no external API, credits or credentials.

## Not implemented

- No AMD API calls, endpoint assumptions, model names or real inference.
- No extraction persistence or change to existing mock `/extract` behavior.
- No medical validation: literal evidence presence **does not establish** clinical accuracy, causality or appropriate interpretation.
- No patient-identifiable data, diagnosis, treatment recommendations or autonomous approvals.

## Next steps

1. Obtain official AMD Token Factory API reference and model catalog.
2. Implement a provider adapter to the documented request/response shape.
3. Connect validated extraction to review workflow; reject or flag unsupported evidence and preserve mandatory human approval.
4. Run documented real-inference tests only after credentials are available.

Run tests from `backend`: `PYTHONPATH=. pytest -q`.
