# CourseScope

CourseScope is a role-based learning dashboard built with Next.js, NestJS, Prisma, and PostgreSQL. One protected API response powers revenue, regional financial efficiency, and learning-health visuals while enforcing each user's region scope in the backend.

## Setup

Prerequisites:

- Node.js 20+
- pnpm 10.30.1
- A running PostgreSQL database matching the committed `.env`

From a fresh clone:

```bash
pnpm dev:setup
```

Open [http://localhost:3000](http://localhost:3000). The API runs at `http://localhost:3001`.

The command installs packages and starts the frontend and API. During every API startup, `prisma migrate deploy` checks migration history: an empty database receives the full migration, while an existing database receives only pending migrations. The supplied dataset plus demo users are then seeded repeatably. The assessment permits the local throwaway `.env`, so it is committed and can be changed if PostgreSQL uses different credentials.

PostgreSQL is a project prerequisite; the start command does not install or launch a database server. Docker remains an optional helper through `pnpm db:up`.

For later runs, `pnpm dev` starts the applications without reinstalling packages. Database operations remain available separately:

```bash
pnpm db:migrate
pnpm db:seed
```

## Login credentials

All demo users use the password `Demo@123`.

| User | Email | Data access |
| --- | --- | --- |
| Admin | `admin@coursescope.test` | All regions or one selected region |
| North Manager | `north@coursescope.test` | North only |
| South Manager | `south@coursescope.test` | South only |

## Approach

### Data model

The nested JSON is normalized into four core tables:

- `students`: learner identity, region, and join date.
- `courses`: course details and category.
- `enrollments`: the student-course relationship plus status, grade, rating, and fee paid. `(student_id, course_id)` is the composite primary key.
- `users`: login identity, password hash, role, and assigned manager region.

Authentication adds `auth_sessions`, `password_reset_tokens`, and `auth_audit_logs` for revocation, recovery, and security history.

`apps/api/prisma/schema.prisma` is the readable model, while the versioned `.sql` migration creates the real schema, foreign keys, checks, and indexes. The seed flattens nested enrollments and upserts rows inside one transaction so it can be run again without duplicating data.

### Role-based scope

Authentication uses a short-lived signed JWT plus a rotating opaque refresh token in HTTP-only cookies. Every protected request checks a revocable database session and reloads the current user before resolving the permitted region:

- Admin can request all data or one valid region.
- A manager always receives only their assigned region.
- A manager requesting another region receives `403 Forbidden`, even when calling the API directly.
- An unknown region receives `400 Bad Request`.

The frontend filter is only user experience; PostgreSQL query scoping is decided by the authenticated backend path. The same `GET /analytics/dashboard` endpoint and the same revenue chart component are used for all users.

Local auth also includes login throttling and lockout, password-reset tokens, audit events, exact-origin CSRF protection, strict JWT claim validation, and logout/session revocation. Production password-reset delivery is configured through `PASSWORD_RESET_WEBHOOK_URL`.

### Additional insight

The dashboard also shows completion rate, drop rate, and average rating by category. A visual regional financial pulse pairs revenue per learner with completion rate, so high revenue is not mistaken for efficient or healthy delivery. Every metric is calculated inside the same authorized scope. In the supplied sample, Design has the weakest completion and rating results, making it the clearest category to investigate.

### Decisions and trade-offs

- Prisma keeps the persistence layer small: one declarative schema, one SQL migration, one injected client, and one seed file. The analytics still use parameterized PostgreSQL aggregates because grouped reporting is clearer and more efficient in SQL.
- Prisma 6 is pinned deliberately: it supports the project's Node 20 baseline without the driver-adapter and ESM migration required by Prisma 7.
- Application-level scoping keeps the assessment flow easy to follow. PostgreSQL row-level security would be a useful second boundary for a multi-tenant production system.
- Demo users are seeded rather than registered because user administration is outside the assignment.
- Native CSS bars avoid adding a chart dependency for four categories.

## Working with AI

AI helped extract requirements, profile the dataset, draft the schema and implementation, plan issues, and propose tests. I reviewed authentication, authorization, database predicates, validation, and the final computed totals instead of accepting generated output directly.

An early AI-generated aggregation filtered the dataset to completed enrollments before calculating the completion percentage, which incorrectly produced `100%`. Comparing it with raw status counts exposed the error. The final query independently counts completed rows and all enrollment rows before calculating the percentage.

### AI-first delivery workflow

1. Read the requirement and profile the supplied data.
2. Search existing ADRs and RCAs before implementing a feature or fixing a bug.
3. Define acceptance criteria and track the work through GitHub Issues and the sprint board.
4. Use AI to draft the smallest implementation and tests.
5. Manually review security, authorization, data integrity, validation, and failure handling.
6. Run deterministic type, test, build, database, API, and browser checks appropriate to the change.
7. Record durable architecture decisions in an ADR. For a significant bug, write an RCA and link the fix, regression test, and prevention work.

A formal RCA is required for authorization bypass, data exposure, data corruption, repeated production failure, or a substantial user-visible outage. Every feature and bug starts with a related ADR/RCA search so an earlier failure pattern is not repeated.

Project workflow references:

- [AI-first SDLC](docs/ai-sdlc.md)
- [Region-scope architecture decision](docs/architecture/0001-server-enforced-region-scope.md)
- [RCA policy and template](docs/rca)
- [Sprint Kanban](https://github.com/users/Eshan-Mishra/projects/6)
- [Sprint 1 milestone](https://github.com/Eshan-Mishra/course-scope-dashboard/milestone/1)
- [Engineering wiki](https://github.com/Eshan-Mishra/course-scope-dashboard/wiki)
