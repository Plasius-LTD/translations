/**
 * BCP-47 language tag (e.g., "en", "en-GB", "zh-Hant-HK", "ar-EG").
 * We accept any well-formed tag at type level to avoid limiting supported locales.
 */
export type LanguageCode = string;

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

export function normalizeBundlePath(bundlePath: string): BundlePath {
  const trimmed = bundlePath.trim().replace(/^\/+|\/+$/g, "");
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
    currentLanguage = lang;
    direction = getDirection(lang);
  };

  const loadTranslations = (
    lang: LanguageCode,
    dict: TranslationDictionary,
    options: LoadTranslationsOptions = {}
  ): void => {
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

  const hasLoadedBundle = (lang: LanguageCode, bundlePath: BundlePath): boolean =>
    ensureLanguageEntry(lang).bundleDictionaries.has(normalizeBundlePath(bundlePath));

  const getLoadedBundlePaths = (lang: LanguageCode): readonly BundlePath[] =>
    [...ensureLanguageEntry(lang).bundleDictionaries.keys()];

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
const RTL_SCRIPTS = new Set(["Arab", "Hebr", "Thaa", "Syrc"]);

const getDirection = (lang: LanguageCode): Direction => {
  if (!lang) return "ltr";
  // Split BCP‑47 tag: primary-language [ - script ] [ - region ] ...
  const parts = String(lang).split("-");
  const primary = (parts[0] || "").toLowerCase();
  if (RTL_LANGS.has(primary)) return "rtl";
  // Look for 4-letter Script subtag (TitleCase by spec). Keep case as-is for comparison set.
  const script = parts.find(p => p.length === 4);
  if (script && RTL_SCRIPTS.has(script)) return "rtl";
  return "ltr";
};
