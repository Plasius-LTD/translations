# ADR-0003: Bundle-Aware Page Bundle Loading

- Status: Accepted
- Date: 2026-04-11

## Context

`@plasius/translations` previously assumed one flat dictionary per locale fetched from `/i18n/{language}`.

The Plasius site translation rollout now needs:

- logical bundle paths such as `frontend/app-shell` and `frontend/routes/about`,
- deterministic merge semantics when multiple bundles are required for one surface,
- bundle-level fallback to `en-GB`,
- an explicit readiness model for React consumers, and
- a clear contract with the site feature flag `site.i18n.page-bundles.enabled`.

## Decision

`@plasius/translations` will support a bundle-aware runtime alongside the legacy flat-language loader.

The package now:

1. normalizes logical bundle paths and rejects unsafe path segments,
2. fetches bundle paths from `/language/{language}/{bundlePath}`,
3. merges loaded bundles in request order so later overlays override earlier keys without removing untouched keys,
4. falls back to `en-GB` per bundle path when the requested locale bundle is unavailable, and
5. exposes `readyState`, `requiredBundles`, and `error` through `I18nProvider` and `useI18n`.

## Consequences

### Positive

- Site consumers can migrate route by route without downloading one monolithic locale file.
- Public and admin surfaces can declare their required bundles explicitly.
- Fallback behavior is testable at the same bundle granularity used by the backend storage model.

### Negative

- Consumer code must now declare bundle ownership intentionally.
- Partial bundle rollout states need explicit loading and error handling.

## Rollout

- Consumers should keep bundle-aware loading behind `site.i18n.page-bundles.enabled`.
- Legacy `loadLanguage(lang)` without bundle paths remains available during the migration window.
