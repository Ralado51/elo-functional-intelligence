"""Provider-neutral HTTP transport; NOT an AMD Token Factory API implementation.

An endpoint and request/response contract must be supplied from official provider docs.
No application route invokes this transport yet.
"""
from dataclasses import dataclass
from typing import Any

import httpx


class ProviderTransportError(Exception):
    """Safe error category; never includes provider response bodies or credentials."""


class ProviderTimeout(ProviderTransportError):
    pass


class ProviderAuthenticationError(ProviderTransportError):
    pass


class ProviderRateLimitError(ProviderTransportError):
    pass


class ProviderResponseError(ProviderTransportError):
    pass


@dataclass(frozen=True)
class TransportConfig:
    endpoint: str
    api_key: str
    timeout_seconds: float = 20.0

    def __post_init__(self):
        if not self.endpoint.startswith("https://"):
            raise ValueError("Provider endpoint must use HTTPS")
        if not self.api_key:
            raise ValueError("API key is required")
        if not 0 < self.timeout_seconds <= 120:
            raise ValueError("Timeout must be between 0 and 120 seconds")


class ProviderTransport:
    def __init__(self, config: TransportConfig, client: httpx.Client | None = None):
        self.config = config
        self.client = client

    def post_json(self, payload: dict[str, Any], *, auth_header: str = "Authorization") -> dict[str, Any]:
        """Generic JSON POST with configurable auth header.

        Bearer token is a transport default, NOT a claim about AMD's authentication.
        The provider adapter must confirm and explicitly choose the documented auth.
        """
        if not auth_header or "\r" in auth_header or "\n" in auth_header:
            raise ValueError("Invalid auth header")
        headers = {auth_header: f"Bearer {self.config.api_key}", "Accept": "application/json"}
        try:
            if self.client is not None:
                response = self.client.post(self.config.endpoint, json=payload, headers=headers, timeout=self.config.timeout_seconds)
            else:
                with httpx.Client(follow_redirects=False) as client:
                    response = client.post(self.config.endpoint, json=payload, headers=headers, timeout=self.config.timeout_seconds)
        except httpx.TimeoutException as exc:
            raise ProviderTimeout("Provider request timed out") from None
        except httpx.RequestError as exc:
            raise ProviderTransportError("Provider connection failed") from None
        if response.status_code in (401, 403):
            raise ProviderAuthenticationError("Provider authentication rejected")
        if response.status_code == 429:
            raise ProviderRateLimitError("Provider rate limit exceeded")
        if not 200 <= response.status_code < 300:
            raise ProviderResponseError(f"Provider returned HTTP {response.status_code}")
        try:
            data = response.json()
        except ValueError:
            raise ProviderResponseError("Provider returned invalid JSON") from None
        if not isinstance(data, dict):
            raise ProviderResponseError("Provider response must be a JSON object")
        return data
