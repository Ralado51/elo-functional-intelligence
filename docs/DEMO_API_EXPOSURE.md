# API exposure review for the synthetic demonstration

This is a configuration recommendation and local hardening change, not a deployment. Do not publish the current API directly to the Internet. It has unauthenticated write endpoints and global synthetic-record reads; a professional UUID is not an authenticated identity.

## Findings and local configuration

- `POST /sessions`, `/sessions/{id}/extract`, `/sessions/{id}/approve`, registry creation/linking and `/registry/observations/{id}/review` mutate records. They must not be exposed publicly without an authorization layer.
- CORS allows only `http://localhost:5173` and `http://127.0.0.1:5173`, with GET/POST and Content-Type. Those development defaults remain unchanged. CORS controls browser access to responses, not direct HTTP clients or write authorization. Regression tests demonstrate both the narrow preflight allowlist and the fact that a direct client can still POST.
- Compose previously published `8000:8000`, which binds all host interfaces by default. It now publishes **`127.0.0.1:8000:8000`**. The Dockerfile still listens on `0.0.0.0` inside the container so Docker forwarding works; `EXPOSE 8000` is image metadata, not a host firewall. Do not add a second public publication in an override file.
- A direct development launch must use `uvicorn app.main:app --host 127.0.0.1 --port 8000`. Development Vite should also bind loopback. Access the operator UI through a local machine or approved SSH/VPN tunnel. Check effective bindings with `ss -ltnp` and resolved configuration with `docker compose config`.

## Recommended audience-facing demo boundary

Prefer a private demo/tunnel rather than a public API. If an audience-facing deployment is later explicitly approved, use an authenticated HTTPS reverse proxy in front of a private API. Publish only proxy ports, block port 8000 in host/cloud firewalls, and use a trusted container network inaccessible to audience clients. Build the audience frontend with `VITE_API_URL=/api` for same-origin requests; do not broaden CORS to `*`.

At the proxy, deny all API mutations, independent of CORS. For example, inside an already configured TLS/authenticated Nginx server:

```nginx
# Illustration only: TLS certificates, audience authentication, request limits,
# firewall rules and trusted proxy/network configuration must be supplied and
# reviewed for the actual host before any deployment.
location /api/ {
    limit_except GET { deny all; }
    proxy_pass http://127.0.0.1:8000/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Nginx's GET allowance also permits HEAD; neither should mutate data. Keep the entire site behind audience authentication and limit read routes further when needed—GET endpoints can expose source notes and audit references even though the fixtures are synthetic. For a proxy running in a separate container, use the API's private service address instead of host loopback and expose no API host port to the Internet. Never trust arbitrary client-supplied forwarded headers for authentication.

Keep operator writes on a separate private, authenticated route or local tunnel. Hiding buttons is insufficient: verify an external `POST /api/sessions` and POSTs to extraction, approval and registry review paths receive a denial **without reaching the backend**. Verify direct remote connections to port 8000 fail. Check permitted GET dashboard requests independently, and verify untrusted origins do not receive wildcard CORS authorization. No gateway was deployed or externally penetration-tested in this task.

Keep the AMD key server-side, require the existing `ELO_SYNTHETIC_ONLY_ACK=true` before AMD extraction, and retain explicit human review. Do not put keys in `VITE_` variables, URLs, screenshots or logs. Use only synthetic fixtures; no public real-patient data, model-generated automatic approval or signed clinical reports are supported.

## Validation performed

`docker compose config --quiet` passed. Local runtime listeners were verified at `127.0.0.1:8000` and `127.0.0.1:5173`. Four API exposure tests cover both allowed development origins, disallowed-origin preflight and direct-client write behavior. These checks validate the local boundaries and clarify their limits; they do not certify an Internet deployment as secure.
