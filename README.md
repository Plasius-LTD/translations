# @plasius/translations

[![npm version](https://img.shields.io/npm/v/@plasius/translations.svg)](https://www.npmjs.com/package/@plasius/translations)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Plasius-LTD/translations/ci.yml?branch=main&label=build&style=flat)](https://github.com/Plasius-LTD/translations/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/codecov/c/github/Plasius-LTD/translations)](https://codecov.io/gh/Plasius-LTD/translations)
[![License](https://img.shields.io/github/license/Plasius-LTD/translations)](./LICENSE)
[![Code of Conduct](https://img.shields.io/badge/code%20of%20conduct-yes-blue.svg)](./CODE_OF_CONDUCT.md)
[![Security Policy](https://img.shields.io/badge/security%20policy-yes-orange.svg)](./SECURITY.md)
[![Changelog](https://img.shields.io/badge/changelog-md-blue.svg)](./CHANGELOG.md)

Apache-2.0. ESM + CJS builds. TypeScript types included.

---

## Overview

`@plasius/translations` is the shared Plasius i18n runtime for flat locale dictionaries and page-scoped translation bundles.

---

## Installation

```bash
npm install @plasius/translations
```

---

## Demo

```bash
npm run build
node demo/example.mjs
```

See `demo/README.md` for the local sanity-check scaffold.

---

## Usage Example

### Accessing the store

```tsx
import { getTranslator, loadLanguage } from "@plasius/translations";

const i18n = getTranslator();

await loadLanguage("fr-FR");

// Translate keys using t()
console.log(i18n.t("hello")); // → "Bonjour" (if loaded)

// Fallback if key not found
console.log(i18n.t("unknown_key")); // → "unknown_key"
```

### Scoped translations in React

```tsx
import React from "react";
import { I18nProvider, useI18n } from "@plasius/translations";

function Greeting() {
  const { t, isReady, readyState } = useI18n();

  if (!isReady) {
    return <p>{readyState === "error" ? "Translation load failed" : t("loading")}</p>;
  }

  return <h1>{t("hello")}</h1>;
}

export default function App() {
  return (
    <I18nProvider
      initialLang="en-GB"
      bundlePaths={["frontend/app-shell", "frontend/routes/about"]}
    >
      <Greeting />
    </I18nProvider>
  );
}
```

### Page bundle loading

Use `bundlePaths` when a consumer needs backend-served page bundles.

```tsx
import { I18nProvider, loadLanguage } from "@plasius/translations";

await loadLanguage("fr-FR", {
  bundlePaths: ["frontend/app-shell", "frontend/routes/about"],
});
```

Bundle requests use `/language/{language}/{bundlePath}` and merge in the order requested. If a requested locale bundle is missing, the same logical path is retried against `en-GB`.

### Readiness contract

`useI18n()` returns:

- `readyState`: `"idle" | "loading" | "ready" | "error"`
- `isReady`: convenience boolean for `"ready"`
- `requiredBundles`: normalized bundle paths for the current provider scope
- `error`: the last bundle-loading error when `readyState === "error"`

This is the package-level contract used by the site rollout behind `site.i18n.page-bundles.enabled`.

### Translation file format

Translation dictionaries are defined as simple JSON files where each key is a string identifier and the value is the translated text. For example:

```json
{
  "hello": "Hello",
  "goodbye": "Goodbye",
  "loading": "Loading...",
  "user": {
    "profile": "Profile",
    "settings": "Settings"
  }
}
```

Nested objects are supported to help group related keys, and can be accessed with dot notation in your code (e.g. `t("user.profile")`).

For page-bundle rollout work, prefer flat key/value JSON within each logical bundle so merge order and ownership remain explicit.

### Composite and complex sentences

You can also handle more advanced translations where sentences are constructed dynamically or contain placeholders for values.

#### Placeholders

```json
{
  "welcome_user": "Welcome, {name}!",
  "items_in_cart": "You have {count} items in your cart."
}
```

Usage:

```tsx
i18n.t("welcome_user", { name: "Alice" }); // → "Welcome, Alice!"
i18n.t("items_in_cart", { count: 3 });     // → "You have 3 items in your cart."
```

#### Nested and composite phrases

```json
{
  "order": {
    "status": {
      "pending": "Your order is pending",
      "shipped": "Your order has shipped",
      "delivered": "Your order was delivered on {date}"
    }
  }
}
```

Usage:

```tsx
i18n.t("order.status.pending"); // → "Your order is pending"
i18n.t("order.status.delivered", { date: "2025-09-17" });
// → "Your order was delivered on 2025-09-17"
```

This approach allows both simple keys and complex nested sentences with dynamic data to be resolved consistently.

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Contributor License Agreement](./legal/CLA.md)

---

## License

This project is licensed under the terms of the [Apache 2.0 license](./LICENSE).
