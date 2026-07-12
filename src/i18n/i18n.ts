import { validateLanguage } from "@plasius/schema";

/**
 * Language tag accepted by the documented @plasius/schema RFC 5646 subset.
 * Runtime validation is required because the TypeScript representation is a string.
 */
export type LanguageCode = string;

/** Returns whether a value belongs to the shared Plasius RFC 5646 subset. */
export function isValidLanguageCode(value: unknown): value is LanguageCode {
  return validateLanguage(value);
}

function assertLanguageCode(value: unknown, field: string): asserts value is LanguageCode {
  if (!isValidLanguageCode(value)) {
    throw new TypeError(`${field} must be a supported RFC 5646 language tag`);
  }
}

export type Direction = "ltr" | "rtl";

export type BundlePath = string;

export type TranslationArgs = Record<string, string | number | boolean>;

export type TranslationValue = string | ((args: TranslationArgs) => string);

export type TranslationDictionary = Record<string, TranslationValue>;

export interface I18nConfig {
  language: LanguageCode;
  fallback: LanguageCode;
  translations: Partial<Record<LanguageCode, TranslationDictionary>>;
}

export interface LoadTranslationsOptions {
  readonly bundlePath?: BundlePath;
  readonly replace?: boolean;
}

interface LanguageEntry {
  baseDictionary: TranslationDictionary | null;
  baseIsDefaultPlaceholder: boolean;
  bundleDictionaries: Map<BundlePath, TranslationDictionary>;
  mergedDictionary: TranslationDictionary;
}

const DEFAULT_FALLBACK_LANGUAGE = "en-GB";

const DEFAULT_TRANSLATIONS: Partial<Record<LanguageCode, TranslationDictionary>> = {
  "en-GB": { loading: "Loading..." },
  "en-US": { loading: "Loading..." },
  "fr-FR": { loading: "Chargement..." },
  "es-ES": { loading: "Cargando..." },
  ar: { loading: "جارٍ التحميل..." },
  "pt-PT": { loading: "A carregar..." },
  de: { loading: "Wird geladen..." },
  ja: { loading: "読み込み中..." },
  zh: { loading: "加载中..." },
  ko: { loading: "로딩 중..." },
  mn: { loading: "Ачааллаж байна..." },
};

export interface I18nState {
  readonly language: LanguageCode;
  readonly fallbackLanguage: LanguageCode;
  readonly direction: Direction;
  t: (key: string, args?: TranslationArgs) => string;
  setLanguage: (lang: LanguageCode) => void;
  loadTranslations: (
    lang: LanguageCode,
    dict: TranslationDictionary,
    options?: LoadTranslationsOptions
  ) => void;
  loadBundleTranslations: (
    lang: LanguageCode,
    bundlePath: BundlePath,
    dict: TranslationDictionary
  ) => void;
  hasLoadedBundle: (lang: LanguageCode, bundlePath: BundlePath) => boolean;
  getLoadedBundlePaths: (lang: LanguageCode) => readonly BundlePath[];
}

const MAX_BUNDLE_PATH_LENGTH = 512;

export function normalizeBundlePath(bundlePath: string): BundlePath {
  const input = bundlePath.trim();
  if (input.length > MAX_BUNDLE_PATH_LENGTH) {
    throw new Error("bundlePath is too long");
  }

  let startIndex = 0;
  let endIndex = input.length;
  while (startIndex < endIndex && input.charCodeAt(startIndex) === 47) {
    startIndex += 1;
  }
  while (endIndex > startIndex && input.charCodeAt(endIndex - 1) === 47) {
    endIndex -= 1;
  }
  const trimmed = input.slice(startIndex, endIndex);
  if (!trimmed) {
    throw new Error("bundlePath must not be empty");
  }

  const segments = trimmed.split("/");
  if (
    segments.some(
      (segment) => segment.length === 0 || segment === "." || segment === ".."
    )
  ) {
    throw new Error(`bundlePath contains an invalid segment: ${bundlePath}`);
  }

  return segments.join("/");
}

function cloneDictionary(dict: TranslationDictionary | null): TranslationDictionary | null {
  return dict ? { ...dict } : null;
}

function mergeDictionaryLayers(
  baseDictionary: TranslationDictionary | null,
  bundleDictionaries: Map<BundlePath, TranslationDictionary>
): TranslationDictionary {
  const mergedDictionary: TranslationDictionary = {};

  if (baseDictionary) {
    Object.assign(mergedDictionary, baseDictionary);
  }

  for (const bundleDictionary of bundleDictionaries.values()) {
    Object.assign(mergedDictionary, bundleDictionary);
  }

  return mergedDictionary;
}

function createDefaultEntry(lang: LanguageCode): LanguageEntry {
  const defaultDictionary = cloneDictionary(DEFAULT_TRANSLATIONS[lang] ?? null);

  return {
    baseDictionary: defaultDictionary,
    baseIsDefaultPlaceholder: defaultDictionary !== null,
    bundleDictionaries: new Map(),
    mergedDictionary: defaultDictionary ? { ...defaultDictionary } : {},
  };
}

export const createI18n = (config: I18nConfig): I18nState => {
  assertLanguageCode(config.language, "language");
  assertLanguageCode(config.fallback, "fallback");
  let currentLanguage = config.language;
  let direction = getDirection(config.language);
  const languageEntries = new Map<LanguageCode, LanguageEntry>();

  const ensureLanguageEntry = (lang: LanguageCode): LanguageEntry => {
    const existingEntry = languageEntries.get(lang);
    if (existingEntry) {
      return existingEntry;
    }

    const entry = createDefaultEntry(lang);
    languageEntries.set(lang, entry);
    return entry;
  };

  const recomputeEntry = (entry: LanguageEntry): void => {
    entry.mergedDictionary = mergeDictionaryLayers(
      entry.baseDictionary,
      entry.bundleDictionaries
    );
  };

  const setBaseDictionary = (
    lang: LanguageCode,
    dict: TranslationDictionary,
    replace = true
  ): void => {
    const entry = ensureLanguageEntry(lang);

    entry.baseDictionary = replace
      ? { ...dict }
      : {
          ...(entry.baseDictionary ?? {}),
          ...dict,
        };
    entry.baseIsDefaultPlaceholder = false;
    recomputeEntry(entry);
  };

  for (const [lang, dict] of Object.entries(config.translations)) {
    assertLanguageCode(lang, "translations language");
    if (!dict) {
      continue;
    }

    setBaseDictionary(lang, dict);
  }

  const hasMeaningfulDictionary = (entry: LanguageEntry | undefined): boolean =>
    Boolean(
      entry &&
        ((!entry.baseIsDefaultPlaceholder && entry.baseDictionary) ||
          entry.bundleDictionaries.size > 0)
    );

  const resolveDict = (lang: LanguageCode): TranslationDictionary => {
    const currentEntry = languageEntries.get(lang);
    if (hasMeaningfulDictionary(currentEntry)) {
      return currentEntry!.mergedDictionary;
    }

    const fallbackEntry = ensureLanguageEntry(config.fallback);
    if (hasMeaningfulDictionary(fallbackEntry)) {
      return fallbackEntry.mergedDictionary;
    }

    return (
      fallbackEntry.mergedDictionary ??
      DEFAULT_TRANSLATIONS[DEFAULT_FALLBACK_LANGUAGE] ??
      {}
    );
  };

  const t = (key: string, args: TranslationArgs = {}): string => {
    const dict = resolveDict(currentLanguage);
    const value = dict[key];

    if (typeof value === "function") {
      return value(args);
    }

    if (typeof value === "string") {
      return value.replace(/\{(\w+)\}/g, (_: string, placeholder: string) => {
        const replacement = args[placeholder];
        return replacement !== undefined ? String(replacement) : `{${placeholder}}`;
      });
    }

    return key;
  };

  const setLanguage = (lang: LanguageCode): void => {
    assertLanguageCode(lang, "language");
    currentLanguage = lang;
    direction = getDirection(lang);
  };

  const loadTranslations = (
    lang: LanguageCode,
    dict: TranslationDictionary,
    options: LoadTranslationsOptions = {}
  ): void => {
    assertLanguageCode(lang, "translations language");
    if (options.bundlePath) {
      const normalizedBundlePath = normalizeBundlePath(options.bundlePath);
      const entry = ensureLanguageEntry(lang);
      entry.bundleDictionaries.set(normalizedBundlePath, { ...dict });
      recomputeEntry(entry);
      return;
    }

    setBaseDictionary(lang, dict, options.replace ?? true);
  };

  const loadBundleTranslations = (
    lang: LanguageCode,
    bundlePath: BundlePath,
    dict: TranslationDictionary
  ): void => {
    loadTranslations(lang, dict, { bundlePath });
  };

  const hasLoadedBundle = (lang: LanguageCode, bundlePath: BundlePath): boolean => {
    assertLanguageCode(lang, "bundle language");
    return ensureLanguageEntry(lang).bundleDictionaries.has(normalizeBundlePath(bundlePath));
  };

  const getLoadedBundlePaths = (lang: LanguageCode): readonly BundlePath[] => {
    assertLanguageCode(lang, "bundle language");
    return [...ensureLanguageEntry(lang).bundleDictionaries.keys()];
  };

  return {
    get language() {
      return currentLanguage;
    },
    get fallbackLanguage() {
      return config.fallback;
    },
    get direction() {
      return direction;
    },
    t,
    setLanguage,
    loadTranslations,
    loadBundleTranslations,
    hasLoadedBundle,
    getLoadedBundlePaths,
  };
};

// Languages and scripts that are written right-to-left
const RTL_LANGS = new Set(["ar", "he", "fa", "ur", "dv", "ps", "ku", "syr", "ug", "yi"]);
const RTL_SCRIPTS = new Set(["arab", "hebr", "thaa", "syrc"]);

const getDirection = (lang: LanguageCode): Direction => {
  if (!lang) return "ltr";
  // Split BCP‑47 tag: primary-language [ - script ] [ - region ] ...
  const parts = String(lang).split("-");
  const primary = (parts[0] || "").toLowerCase();
  if (RTL_LANGS.has(primary)) return "rtl";
  // RFC 5646 matching is case-insensitive even though script casing has a canonical form.
  const script = parts.find(p => p.length === 4);
  if (script && RTL_SCRIPTS.has(script.toLowerCase())) return "rtl";
  return "ltr";
};
