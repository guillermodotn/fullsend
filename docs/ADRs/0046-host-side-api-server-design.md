---
title: "46. Host-side API server design for sandboxed agents"
status: Accepted
relates_to:
  - agent-infrastructure
  - security-threat-model
topics:
  - sandbox
  - api-server
  - credential-isolation
---

# 46. Host-side API server design for sandboxed agents

Date: 2026-06-02

## Status

Accepted

<!-- Once this ADR is Accepted, its content is frozen. Do not edit the Context,
     Decision, or Consequences sections. If circumstances change, write a new
     ADR that supersedes this one. Only status changes and links to superseding
     ADRs should be added after acceptance. -->

## Context

[ADR 0024](0024-harness-definitions.md) introduced the `api_servers` harness field as planned but not
implemented. [ADR 0017](0017-credential-isolation-for-sandboxed-agents.md)/[ADR 0025](0025-provider-credential-delivery-for-sandboxed-agents.md) established the host-side REST server as Tier 3
of the credential delivery model — for cases where providers (Tier 2) cannot
handle: long-running operations exceeding MCP timeouts, operations the sandbox
deliberately blocks (container builds, see
[NVIDIA/OpenShell#113](https://github.com/NVIDIA/OpenShell/issues/113)),
credentials in request bodies, response transformation, and multi-step atomic
operations.

The `host-side-api-server` experiment
([fullsend-ai/experiments#28](https://github.com/fullsend-ai/experiments/pull/28))
validated the end-to-end flow with two servers (Go container builder, Python
repo provisioner), testing lifecycle management, API discoverability, L7 policy
tuning, per-run auth, and file transfer. This ADR records the design decisions
informed by that experiment.

## Options

### API discoverability

Three approaches were tested. `/tools.json` (structured tool-use schema) was
the most token-efficient under full access (92k tokens vs 107k for OpenAPI,
100k for baked instructions). Both discovery-based methods fail under
restricted policies where the endpoint is blocked; baked instructions succeed
(84k) but can drift from the actual API. OpenAPI's verbose structure adds
context tokens without proportional benefit for LLM agents.

### Per-run authentication

**UUID bearer token via provider placeholders:** simple, proven, no key
management. The proxy resolves the placeholder — the real token never enters
the sandbox. No claims or expiry.

**Short-lived JWTs with claims:** per-operation authorization and audit trail,
but adds signing key management and JWT library dependencies in every server.
The L7 policy already restricts reachable endpoints, making JWT claims a
redundant second layer.

### File transfer between server and sandbox

**`openshell sandbox upload/download` from the server:** works today, validated
by experiment, handles real-time exchange during request handling. Couples
server to OpenShell CLI.

**Shared host mount:** transparent POSIX access, no CLI coupling. Depends on
OpenShell mount support that is not yet universally available
([NVIDIA/OpenShell#1509](https://github.com/NVIDIA/OpenShell/issues/1509)).

**HTTP multipart via the API:** fully portable, but large files through the L7
proxy add overhead.

## Decision

Adopt the host-side API server design with the following process contract,
policy model, and security requirements. Full design details in the
[`host-side-api-server` experiment](https://github.com/fullsend-ai/experiments/pull/28).

**Process contract.** Every host-side API server must accept `--port`,
`--token`, and `--bind-address` CLI flags; serve `GET /healthz`
(unauthenticated) and `GET /tools.json` (structured tool-use schema) for agent
discovery; validate bearer tokens on all other endpoints; and shut down cleanly
on `SIGTERM`. Servers must write logs to stderr; the runner collects and
bundles logs from all API servers so they are available for inspection after
the run completes. The runner starts servers after pre-script, health-checks
before sandbox creation, and tears down after sandbox destruction. If a server
crashes mid-run, the run fails.

**Network policy via composable provider profiles.** Each API server ships
atomic capability profiles — one per logical group of endpoints (e.g.,
`builder-build`, `builder-push`, `builder-read`). Harnesses list which profiles
to attach. Composition is additive per OpenShell's provider-backed policy
composition
([NVIDIA/OpenShell#1037](https://github.com/NVIDIA/OpenShell/pull/1037)).
Different agent roles compose different capability sets for the same server.
Requires OpenShell >= v0.0.37 and
[#776](https://github.com/fullsend-ai/fullsend/issues/776).

**Per-run auth:** UUID bearer token via OpenShell provider placeholders. JWTs
are a future enhancement when per-operation claims become necessary.

**File transfer:** `openshell sandbox upload/download` from the server during
request handling. Shared host mount
([NVIDIA/OpenShell#1509](https://github.com/NVIDIA/OpenShell/issues/1509))
will be evaluated as an alternative when available.

**Bind address:** servers default to `127.0.0.1`, runner overrides to
`0.0.0.0` for sandboxed agents.
[NVIDIA/OpenShell#1633](https://github.com/NVIDIA/OpenShell/issues/1633)
(supervisor-proxied host-local endpoints) would eliminate this requirement.

**Security hardening:** timing-safe token comparison, 1 MB request body limits,
rate limiting on unauthenticated endpoints, credential scrubbing in error
messages, bounded in-memory state.

## Consequences

- The `api_servers` harness field ([ADR 0024](0024-harness-definitions.md)) will gain a `providers` sub-field and
  defined runtime behavior — servers can be implemented in any language
  following the uniform process contract.
- Implementing this design requires
  [#776](https://github.com/fullsend-ai/fullsend/issues/776) (provider-backed
  policy composition) as a prerequisite.
- Servers are coupled to the OpenShell CLI for file transfer until shared host
  mounts are universally available.
- Servers must bind to `0.0.0.0` on shared hosts, widening the attack surface
  until [NVIDIA/OpenShell#1633](https://github.com/NVIDIA/OpenShell/issues/1633)
  ships.
- API servers (Tier 3) are now clearly scoped to cases providers cannot
  handle: long-running operations, sandbox capability gaps, credentials in
  request bodies, response transformation, and multi-step atomic operations.
