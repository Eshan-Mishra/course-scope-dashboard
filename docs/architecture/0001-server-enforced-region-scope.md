# ADR 0001 Server Enforced Region Scope

## Status

Accepted

## Context

Managers may see only their assigned region. A browser filter is user experience, not an authorization boundary, and direct API calls must remain safe.

## Decision

Authentication puts the user's role and assigned region in a signed, HTTP-only session cookie. Every analytics request passes through one guard and one `ScopeService`. The service derives the effective database scope from the authenticated user. Admins may request all data or one valid region. Managers are always limited to their assigned region; requesting another region returns `403`.

All dashboard metrics are queried with the same effective scope. There are no role-specific endpoints or widgets.

## Consequences

- Authorization is enforced before the query runs.
- New analytics must use `ScopeService`; bypassing it is a review blocker.
- The current single-region manager model is intentionally simple. A join table can replace the nullable `users.region` column if multi-region assignments become real.

