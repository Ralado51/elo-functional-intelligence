import httpx
import pytest

from app.provider_transport import (
    ProviderAuthenticationError, ProviderRateLimitError, ProviderResponseError,
    ProviderTimeout, ProviderTransport, ProviderTransportError, TransportConfig,
)


def config() -> TransportConfig:
    return TransportConfig(endpoint="https://provider.example.test/inference", api_key="dummy-secret")


def transport(handler):
    return ProviderTransport(config(), httpx.Client(transport=httpx.MockTransport(handler)))


def test_success_uses_json_and_does_not_return_secret():
    def handler(request):
        assert request.headers["Authorization"] == "Bearer dummy-secret"
        assert request.url.scheme == "https"
        assert request.content == b'{"synthetic":true}'
        return httpx.Response(200, json={"result": "synthetic-only"})
    assert transport(handler).post_json({"synthetic": True}) == {"result": "synthetic-only"}


@pytest.mark.parametrize("status,exception", [
    (401, ProviderAuthenticationError), (403, ProviderAuthenticationError),
    (429, ProviderRateLimitError), (500, ProviderResponseError),
])
def test_http_errors_are_categorized_and_redacted(status, exception):
    t = transport(lambda request: httpx.Response(status, text="secret internal response"))
    with pytest.raises(exception) as error:
        t.post_json({})
    assert "secret internal response" not in str(error.value)
    assert "dummy-secret" not in str(error.value)


def test_invalid_json_is_rejected():
    t = transport(lambda request: httpx.Response(200, text="not json"))
    with pytest.raises(ProviderResponseError):
        t.post_json({})


def test_non_object_json_is_rejected():
    t = transport(lambda request: httpx.Response(200, json=[1, 2]))
    with pytest.raises(ProviderResponseError):
        t.post_json({})


def test_timeout_is_categorized():
    def handler(request):
        raise httpx.ReadTimeout("timeout", request=request)
    with pytest.raises(ProviderTimeout):
        transport(handler).post_json({})


def test_connection_error_is_categorized():
    def handler(request):
        raise httpx.ConnectError("offline", request=request)
    with pytest.raises(ProviderTransportError):
        transport(handler).post_json({})


def test_http_endpoint_and_bad_timeout_rejected():
    with pytest.raises(ValueError):
        TransportConfig(endpoint="http://provider.example.test", api_key="dummy")
    with pytest.raises(ValueError):
        TransportConfig(endpoint="https://provider.example.test", api_key="dummy", timeout_seconds=0)
