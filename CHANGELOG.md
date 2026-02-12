# Changelog

All notable changes to this project will be documented in this file.

The format is based on **[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)**, and this project adheres to **[Semantic Versioning](https://semver.org/spec/v2.0.0.html)**.

---

## [Unreleased]

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.8] - 2026-01-22

- **Added**
  - (placeholder)

- **Changed**
  - Restore `main`, `module`, and `types` fields alongside the export map for dual ESM/CJS support.
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.7] - 2025-09-25

- **Added**
  - Increased the number of languages supported to be BCP47 language codes friendly.

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.6] - 2025-09-25

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.5] - 2025-09-24

- **Added**
  - (placeholder)

- **Changed**
  - package.json update to include:
    - "sideEffects": false,
    - "files": ["dist"],
  - package.json removed:
    - "main": "./dist/index.cjs",
    - "module": "./dist/index.js",
    - "types": "./dist/index.d.ts",

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.4] - 2025-09-17

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.0.3] - 2025-09-17

- **Fixed**
  - CD Pipeline now reordered to include version correctly into change log.

## [1.0.2] - 2025-09-17

- **Added**
  - Code coverage

## [1.0.1] - 2025-09-17

- **Added**

  - Initial public release of `@plasius/translations`.

- **Changed**

  - N/A (initial release)

- **Fixed**
  - N/A (initial release)

---

## Release process (maintainers)

1. Update `CHANGELOG.md` under **Unreleased** with user‑visible changes.
2. Bump version in `package.json` following SemVer (major/minor/patch).
3. Move entries from **Unreleased** to a new version section with the current date.
4. Tag the release in Git (`vX.Y.Z`) and push tags.
5. Publish to npm (via CI/CD or `npm publish`).

> Tip: Use Conventional Commits in PR titles/bodies to make changelog updates easier.

---

[Unreleased]: https://github.com/Plasius-LTD/translations/compare/v1.0.8...HEAD
[1.0.1]: https://github.com/Plasius-LTD/translations/releases/tag/v1.0.1
[1.0.2]: https://github.com/Plasius-LTD/translations/releases/tag/v1.0.2
[1.0.3]: https://github.com/Plasius-LTD/translations/releases/tag/v1.0.3
[1.0.4]: https://github.com/Plasius-LTD/translations/releases/tag/v1.0.4
[1.0.5]: https://github.com/Plasius-LTD/translations/releases/tag/v1.0.5
[1.0.6]: https://github.com/Plasius-LTD/translations/releases/tag/v1.0.6
[1.0.7]: https://github.com/Plasius-LTD/translations/releases/tag/v1.0.7
[1.0.8]: https://github.com/Plasius-LTD/translations/releases/tag/v1.0.8

## [1.0.8] - 2026-02-11

- **Added**
  - Initial release.

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)
