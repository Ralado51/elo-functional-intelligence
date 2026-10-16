"""AMD Token Factory adapter. Synthetic notes only; never send real health data."""
import json
import os

import httpx
from pydantic import BaseModel, Field, ValidationError

DEFAULT_BASE_URL = "https://developer.amd.com.cn/radeon/api/v1"
DEFAULT_MODEL = "DeepSeek-V4-Flash"


class Candidate(BaseModel):
    functional_domain: str = Field(min_length=2, max_length=80)
    observation_text: str = Field(min_length=1)
    source_excerpt: str = Field(min_length=1)


class CandidateResponse(BaseModel):
    observations: list[Candidate] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)


class AMDInferenceError(Exception):
    pass


SYSTEM_PROMPT = """You extract functional observations from SYNTHETIC pediatric occupational therapy session notes.
Return one JSON object with keys observations (array) and missing_information (array of strings).
Each observation must have functional_domain, observation_text, and source_excerpt.
source_excerpt MUST be an exact, continuous, verbatim substring of the supplied notes.
Do not invent facts, diagnoses, objectives, baselines, or progress. If uncertain, omit the observation and list missing information.
All outputs are drafts requiring professional review. Do not provide clinical recommendations."""


def parse_candidates(raw: str, notes: str) -> CandidateResponse:
    try:
        result = CandidateResponse.model_validate(json.loads(raw))
    except (ValueError, ValidationError) as exc:
        raise AMDInferenceError("Model returned invalid structured extraction") from exc
    if not result.observations:
        return result
    if len(result.observations) > 12:
        raise AMDInferenceError("Too many observations returned")
    for item in result.observations:
        if item.source_excerpt not in notes:
            raise AMDInferenceError("Model evidence does not match source notes verbatim")
    return result


def extract_candidates(notes: str) -> CandidateResponse:
    key = os.getenv("RADEON_API_KEY", "")
    if not key:
        raise AMDInferenceError("RADEON_API_KEY is not configured")
    model = os.getenv("RADEON_MODEL", DEFAULT_MODEL)
    base = os.getenv("RADEON_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    if base != DEFAULT_BASE_URL:
        raise AMDInferenceError("Unexpected AMD endpoint; use the documented Token Factory base URL")
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": notes},
        ],
        "reasoning_effort": "none",
        "response_format": {"type": "json_object"},
        "temperature": 0,
        "max_tokens": 900,
    }
    try:
        with httpx.Client(timeout=90.0) as client:
            response = client.post(
                base + "/chat/completions",
                headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
                json=payload,
            )
            response.raise_for_status()
            body = response.json()
            raw = body["choices"][0]["message"]["content"]
            if not isinstance(raw, str) or not raw.strip():
                raise AMDInferenceError("Model returned empty content")
            return parse_candidates(raw, notes)
    except (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError) as exc:
        raise AMDInferenceError("AMD inference request failed or returned an unexpected response") from exc
