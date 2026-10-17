"""Offline tests: never call AMD and never use real patient data."""
import json

import pytest

from app.amd_inference import AMDInferenceError, parse_candidates, extract_candidates


NOTES = "The child needed three verbal prompts to begin the transition."


def test_verbatim_evidence_is_accepted():
    result = parse_candidates(json.dumps({"observations": [{
        "functional_domain": "Activity transitions",
        "observation_text": "Three verbal prompts were needed.",
        "source_excerpt": "needed three verbal prompts to begin the transition"
    }], "missing_information": []}), NOTES)
    assert len(result.observations) == 1


def test_fabricated_evidence_is_rejected():
    with pytest.raises(AMDInferenceError, match="verbatim"):
        parse_candidates(json.dumps({"observations": [{
            "functional_domain": "Activity transitions",
            "observation_text": "Independent transition",
            "source_excerpt": "The child transitioned independently"
        }]}), NOTES)


@pytest.mark.parametrize("response", ["not json", "[]", '{"observations":[{"functional_domain":"A"}]}'])
def test_invalid_model_response_is_rejected(response):
    with pytest.raises(AMDInferenceError):
        parse_candidates(response, NOTES)


def test_missing_key_prevents_network(monkeypatch):
    monkeypatch.delenv("RADEON_API_KEY", raising=False)
    with pytest.raises(AMDInferenceError, match="not configured"):
        extract_candidates(NOTES)


def test_empty_extraction_is_allowed():
    result = parse_candidates('{"observations":[],"missing_information":["Insufficient evidence"]}', NOTES)
    assert result.observations == []
