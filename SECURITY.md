# Security Notes

This is a take-home demo with seeded credentials. Do not reuse the credentials or development JWT secret in another environment.

The primary security invariant is region isolation. Report any path that allows a manager to observe another region as a high-severity issue and create an RCA linked to its fix.

The local identity system implements:

- 15-minute signed access JWTs plus seven-day opaque rotating refresh tokens;
- server-side session lookup and revocation on every protected request;
- fresh database role/region lookup, so permission changes apply on the next request;
- logout revocation and refresh-token replay detection;
- database-backed login throttling, account lockout, and uniform invalid-credential responses;
- single-use password-reset tokens, production delivery webhook support, and session revocation after reset;
- encrypted TOTP secrets and MFA enforcement at login;
- database auth audit events;
- exact trusted-origin enforcement for unsafe requests;
- runtime validation of JWT issuer, audience, algorithm, token type, identifiers, email, role, region, and role/region consistency.

This remains a locally managed identity system, not a managed identity provider. Production must configure a password-reset delivery webhook, strong independent secrets, trusted-proxy handling, audit retention/export, and an MFA recovery policy.

For a production deployment:

- provide a rotated secret through the deployment platform;
- require HTTPS and secure cookies;
- configure `PASSWORD_RESET_WEBHOOK_URL` over HTTPS and protect it with `PASSWORD_RESET_WEBHOOK_SECRET`;
- configure `TRUST_PROXY=true` only behind the expected single reverse proxy so IP throttling uses the real client address;
- define MFA recovery/disable and auth-audit retention policies;
- consider a managed identity provider if identity operations outgrow the local system;
- consider PostgreSQL row-level security as defense in depth;
- avoid committing real learner data.
