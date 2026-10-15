# Elo Functional Intelligence — MVP v0.1

Target: pediatric occupational therapists supporting children, initially neurodivergent children.

Problem: translate observations from 40-minute sessions into structured, traceable functional records without implying diagnosis or autonomous clinical decisions.

Workflow: synthetic case → session notes → AI extraction (when AMD access is enabled) → evidence verification → therapist review/approval → functional history.

Rules:
- Synthetic case data only for hackathon evaluation; no identifiable child health data.
- Never invent clinical progress, diagnosis, intervention or outcome.
- Missing information must remain explicitly missing.
- Reviewed text is authored and approved by the professional.
- Mock processing is disclosed and must not be presented as AMD inference.
- Longitudinal comparisons require compatible sessions and adequate evidence.

Sprint 1 backend is an in-memory scaffold, not a production medical record system. Authentication, persistence, security controls, evidence span validation, and actual AMD inference are pending.
