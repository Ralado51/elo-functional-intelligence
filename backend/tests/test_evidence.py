import pytest
from pydantic import ValidationError

from app.evidence import AMDSettings, EvidenceExtraction, EvidenceObservation, assess_evidence


NOTES = "Participou de brincadeira com blocos. Precisou de três lembretes verbais."


def observation(evidence: str) -> EvidenceObservation:
    return EvidenceObservation(category="participation", description="Participou de brincadeira.", evidence=evidence)


def test_exact_evidence_is_supported():
    result = assess_evidence(NOTES, EvidenceExtraction(observations=[observation("brincadeira com blocos")]))
    assert result.valid is True
    assert result.unsupported_indices == []


def test_unsupported_evidence_is_flagged_not_silently_accepted():
    result = assess_evidence(NOTES, EvidenceExtraction(observations=[
        observation("brincadeira com blocos"), observation("completou sozinho todas as tarefas")
    ]))
    assert result.valid is False
    assert result.unsupported_indices == [1]


def test_empty_extraction_is_valid_but_has_no_claims():
    result = assess_evidence(NOTES, EvidenceExtraction())
    assert result.valid is True
    assert result.extraction.observations == []


def test_evidence_and_description_are_required():
    with pytest.raises(ValidationError):
        observation("")


def test_invalid_category_is_rejected():
    with pytest.raises(ValidationError):
        EvidenceObservation(category="diagnosis", description="Não permitido", evidence="blocos")


def test_amd_configuration_requires_https_and_redacts_secret():
    with pytest.raises(ValidationError):
        AMDSettings(endpoint="http://example.com", model="placeholder", api_key="secret")
    settings = AMDSettings(endpoint="https://example.com", model="placeholder", api_key="secret")
    assert "secret" not in settings.model_dump_json()
