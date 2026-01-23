
# ADR-0001: i18n Translations

## Status

- Proposed -> Accepted
- Date: 2025-09-12
- Version: 1.0
- Supersedes: N/A
- Superseded by: N/A

## Context

Plasius projects require internationalisation (i18n) to support multiple languages, fallback handling, and consistent translations across applications. Using ad hoc translation handling or third-party libraries (e.g., i18next) introduces issues with typing, runtime safety, or mismatched approaches to non-functional requirements such as testability, scalability, and performance.

## Decision

We will create `@plasius/translations`, a lightweight i18n library for TypeScript and React. This library will provide:

- Core store API for managing language, fallback, and text direction (LTR/RTL),  
- A `t()` function for key-based translations with support for placeholders and nested keys,  
- JSON-based translation dictionaries with support for default and fallback entries,  
- React bindings (`I18nProvider`, `useI18n`) for scoped translation contexts,  
- Strong typing for safe lookups and developer confidence.  

## Consequences

- **Positive:**  
  - Consistent translation handling across projects.  
  - Strong typing prevents errors and increases reliability.  
  - Scoped provider approach works seamlessly with React applications.  

- **Negative:**  
  - Initial development and maintenance overhead.  
  - Limited community ecosystem compared to larger libraries like i18next.  

## Alternatives considered

- **Use i18next or similar third-party library:** Rejected due to heavy runtime, weaker typing integration, and less alignment with Plasius standards.  
- **Ad hoc per-project translations:** Rejected as it increases duplication, complexity, and risk of inconsistency.  

## References

- [Architectural Decision Records (ADR) standard](https://adr.github.io/)
