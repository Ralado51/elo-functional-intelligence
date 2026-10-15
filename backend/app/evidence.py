"""Provider-neutral extraction contract. Synthetic notes only; not a clinical decision system."""
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class EvidenceObservation(BaseModel):
    category: Literal["participation", "communication", "motor", "sensory", "autonomy", "other"]
    description: str = Field(min_length=1)
    evidence: str = Field(min_length=1)
    requires_review: bool = True


class EvidenceExtraction(BaseModel):
    observations: list[EvidenceObservation] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)
    review_status: Literal["pending"] = "pending"


class EvidenceAssessment(BaseModel):
    extraction: EvidenceExtraction
    valid: bool
    unsupported_indices: list[int] = Field(default_factory=list)


def assess_evidence(notes: str, extraction: EvidenceExtraction) -> EvidenceAssessment:
    """Require every quoted evidence span to occur literally in the source notes.

    No semantic or clinical correctness is asserted by this check.
    """
    unsupported = [
        index for index, observation in enumerate(extraction.observations)
        if observation.evidence not in notes
    ]
    return EvidenceAssessment(extraction=extraction, valid=not unsupported, unsupported_indices=unsupported)


class AMDSettings(BaseModel):
    """Configuration shape only; endpoint and model must come from AMD documentation."""
    endpoint: str = Field(min_length=1)
    model: str = Field(min_length=1)
    api_key: str = Field(min_length=1, exclude=True)

    @model_validator(mode="after")
    def require_https(self):
        if not self.endpoint.startswith("https://"):
            raise ValueError("AMD endpoint must use HTTPS")
        return self
