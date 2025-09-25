/**
 * BCP‑47 language tag (e.g., "en", "en-GB", "zh-Hant-HK", "ar-EG").
 * We accept any well-formed tag at type level to avoid limiting supported locales.
 */
export type LanguageCode = string;

export type Direction = "ltr" | "rtl";

export type TranslationArgs = Record<string, string | number | boolean>;

export type TranslationDictionary = Record<string, string | ((args: TranslationArgs) => string)>;

export interface I18nConfig {
  language: LanguageCode;
  fallback: LanguageCode;
  translations: Partial<Record<LanguageCode, TranslationDictionary>>;
}

// --- Defaults ---
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
  ko: { loading: "ローディング中..." },
  mn: { loading: "Ачааллаж байна..." },
};

// --- Runtime State ---
let currentLanguage: LanguageCode = "en-GB";
let direction: Direction = "ltr";
let translations: Partial<Record<LanguageCode, TranslationDictionary>> = { ...DEFAULT_TRANSLATIONS };

export interface I18nState {
  readonly language: LanguageCode;
  readonly direction: Direction;
  t: (key: string, args?: TranslationArgs) => string;
  setLanguage: (lang: LanguageCode) => void;
  loadTranslations: (lang: LanguageCode, dict: TranslationDictionary) => void;
}

export const createI18n = (config: I18nConfig): I18nState => {
  translations = { ...DEFAULT_TRANSLATIONS, ...config.translations };
  currentLanguage = config.language;
  direction = getDirection(config.language);

  const resolveDict = (lang: LanguageCode): TranslationDictionary => {
    const dictForLang = translations[lang];
    const isPlaceholderOnly = dictForLang && DEFAULT_TRANSLATIONS[lang] === dictForLang;
    if (isPlaceholderOnly) {
      // If this language only has the default placeholder dictionary (e.g., just `loading`),
      // treat it as “not loaded yet” and fall back to the configured fallback language.
      return translations[config.fallback] ?? DEFAULT_TRANSLATIONS["en-GB"] ?? {};
    }
    return dictForLang ?? translations[config.fallback] ?? DEFAULT_TRANSLATIONS["en-GB"] ?? {};
  };

  const t = (key: string, args: TranslationArgs = {}): string => {
    const dict = resolveDict(currentLanguage);
    const value = dict[key];

    if (typeof value === "function") {
      return value(args);
    }

    if (typeof value === "string") {
      return value.replace(/\{(\w+)\}/g, (_: string, k: string) => {
        const v = args[k];
        return v !== undefined ? String(v) : `{${k}}`;
      });
    }

    return key;
  };

  const setLanguage = (lang: LanguageCode) => {
    currentLanguage = lang;
    direction = getDirection(lang);
  };

  const loadTranslations = (
    lang: LanguageCode,
    dict: TranslationDictionary
  ) => {
    translations[lang] = dict;
  };

  return {
    get language() {
      return currentLanguage;
    },
    get direction() {
      return direction;
    },
    t,
    setLanguage,
    loadTranslations,
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
