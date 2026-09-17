# Security Notes

This is a take-home demo with seeded credentials. Do not reuse the credentials or development JWT secret in another environment.

The primary security invariant is region isolation. Report any path that allows a manager to observe another region as a high-severity issue and create an RCA linked to its fix.

For a production deployment:

- provide a rotated secret through the deployment platform;
- require HTTPS and secure cookies;
- add CSRF protection for state-changing routes;
- rate-limit login attempts;
- use managed user identities and password reset flows;
- consider PostgreSQL row-level security as defense in depth;
- avoid committing real learner data.
