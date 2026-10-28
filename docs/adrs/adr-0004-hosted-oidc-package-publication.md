# ADR-0004: Hosted OIDC Package Publication

- Status: Accepted
- Date: 2026-08-11

## Context

`@plasius/translations` must publish without a long-lived npm write token and without
accepting CI evidence for another source snapshot.

## Decision

Publication is phase-isolated: dependency installation, package validation, SBOM generation, and immutable tarball packing run in `validate_and_pack` without the `production` environment or OIDC permission. The final hosted `publish` job downloads only that sealed artifact, explicitly installs npm 11.6.2, runs no repository dependency code, and publishes the tarball with lifecycle scripts disabled. It re-fetches current `main` immediately before the first release mutation and again immediately before npm publication. `.npmrc` contains no registry-auth placeholder, and release preparation returns the reviewed current `main` HEAD rather than package-file history.

Publish only from the GitHub-hosted `production` job using npm trusted
publishing. Prove the prepared SHA is still the exact remote `main` head and
that push-triggered `ci.yml` succeeded for it. Require Node 24 and npm 11.5.1 or
newer, request provenance, and prohibit npm write-token fallbacks. CI uses explicit
`[self-hosted, Linux, X64]` runners with caching disabled and
checkout credentials not persisted. Every job admits only this repository's
trusted push/manual events. Trusted branch push CI provides pre-merge checks;
pull-request triggers, caller-controlled selectors, and hosted fallbacks are
excluded. Timeouts and per-branch cancellation bound execution.

Hosted release preparation, publication dispatch, validation/packing and final
publication retain their distinct trust boundaries. Monthly hosted dependency
maintenance proposes reviewable PRs; it does not supply the exact-main CI gate.
This resolves recovery Task #32 under site Story #1626 / Feature #1597.
`platform.public-artifact-integrity.enabled` remains site-owned: enabled permits
staged clean promotion, disabled stops promotion, and mandatory integrity gates
remain unconditional. No new capability or runtime package logic is needed.

## Alternatives and rollback

Hosted CI contradicts the approved recovery requirement. PR-triggered execution
on self-hosted runners would broaden admission unnecessarily; use trusted branch
pushes instead. Keep npm publication hosted for supported OIDC trust. Rollback
disables the affected workflow/channel and promotion; it never restores the
administrative registry, skips integrity checks, or reuses removed versions.

## Consequences

Missing trust configuration, moved `main`, absent CI, unsupported runtime, or
missing OIDC identity fails closed before publication.

## Test implications

Workflow tests enforce source, CI, runtime, identity, runner, and token rules.

CI contract tests enumerate all jobs and enforce fixed runner labels,
repository/event guards, credential-free checkout, cancellation and timeouts.
Delivery requires branch and exact-main CI plus the ordinary production OIDC CD
release and registry verification. No public API or dependency changes.
