# AI First SDLC

This project uses AI as a reviewed engineering collaborator, not as an authority.

## Working loop

1. Understand the requirement and inspect the supplied data.
2. Search existing ADRs and RCAs before choosing an implementation.
3. Convert the requirement into an epic, testable issues, and acceptance criteria.
4. Ask AI for the smallest design that meets the criteria.
5. Review generated code at trust boundaries: authentication, authorization, database queries, validation, and secrets.
6. Run deterministic checks and exercise the real user flow.
7. Record important decisions in an ADR. For a significant bug, write an RCA and link it from the fix.

## AI review log

| Stage | AI contribution | Human review |
| --- | --- | --- |
| Discovery | Extracted requirements and profiled the dataset | Confirmed the core risk is server-side region isolation |
| Planning | Proposed an issue breakdown and acceptance criteria | Cut speculative features and kept one shared API/widget path |
| Design | Suggested role claims plus query scoping | Rejected UI-only filtering as an authorization mechanism |
| Implementation | Drafted schema, API, UI, tests, and docs | Reviewed every scope decision and query predicate |
| Verification | Proposed test cases and expected aggregates | Compared API results with independent dataset calculations |

## AI mistake caught

An early exploratory aggregation divided completed enrollments by the already-filtered completed set, producing a false `100%` completion rate for every region. The calculation was discarded and replaced with database aggregates whose numerator and denominator are independently defined. This is why AI-produced analytics are checked against raw data before being presented.

