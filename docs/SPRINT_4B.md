# Sprint 4B — Provider-neutral HTTP transport

This is an **offline transport scaffold**, not a working AMD Token Factory integration.

## Implemented
- HTTPS-only configuration, bounded request timeout and JSON POST.
- HTTP 401/403, 429, 5xx, timeout, connectivity, invalid JSON and unexpected JSON shape handling.
- No provider response body or API key included in raised error messages.
- `httpx.MockTransport` tests: **no outbound network traffic and no credits consumed**.

## Pending official AMD API documentation
- Actual API base URL/path, authorization scheme and headers.
- Request schema, model identifiers, response envelope and error codes.
- Usage/rate limits, streaming requirements and any data retention policies.
- Only after verification: AMD-specific adapter, validated evidence extraction and opt-in configuration.

The transport currently defaults to Bearer authentication **only as a generic convention**, not as an assertion about AMD. No application route invokes the transport. The existing `/extract` endpoint remains mock-only. Use synthetic data exclusively.

## Local validation
From `backend`: `PYTHONPATH=. pytest -q`.
