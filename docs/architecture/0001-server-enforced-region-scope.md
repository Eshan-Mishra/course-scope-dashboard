# ADR 0001 Server Enforced Region Scope

## Status

Accepted

## Context

Managers may see only their assigned region. A browser filter is user experience, not an authorization boundary, and direct API calls must remain safe.

## Decision

Authentication uses a short-lived signed access JWT and an opaque rotating refresh token in HTTP-only cookies. Every analytics request passes through a guard that runtime-validates the token, checks an active server-side session, and reloads the current user from PostgreSQL. `ScopeService` then derives effective scope from the fresh database role/region. Admins may request all data or one valid region. Managers are always limited to their assigned region; requesting another region returns `403`.

All dashboard metrics are queried with the same effective scope. There are no role-specific endpoints or widgets.

## Consequences

- Authorization is enforced before the query runs.
- New analytics must use `ScopeService`; bypassing it is a review blocker.
- The current single-region manager model is intentionally simple. A join table can replace the nullable `users.region` column if multi-region assignments become real.
- Role/region changes apply on the next protected request because JWT authorization claims are not treated as authoritative.
- Logout and password reset revoke server-side sessions; refresh-token replay revokes the affected session.
