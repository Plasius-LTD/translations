# ADR-0002: Dual ESM and CJS Distribution

## Status

- Proposed -> Accepted
- Date: 2025-09-17
- Version: 1.0
- Supersedes: N/A
- Superseded by: N/A

## Context

The translations library must work in both modern ESM bundlers and CommonJS environments while shipping TypeScript types. This ensures compatibility across apps and build pipelines.

## Decision

We will publish dual ESM and CJS builds using `tsup`, with an exports map that provides:

- `import` -> `dist/index.js`
- `require` -> `dist/index.cjs`
- `types` -> `dist/index.d.ts`

## Consequences

- **Positive:** Broad compatibility, explicit typings, and clearer consumption paths.
- **Negative:** Additional build outputs to maintain.
- **Neutral:** Consumers use the correct format automatically.

## Alternatives Considered

- **ESM-only:** Rejected due to CommonJS compatibility needs.
- **CJS-only:** Rejected because ESM is the primary modern target.
- **Single bundle without exports map:** Rejected for weaker resolution behavior.
