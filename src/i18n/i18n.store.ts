// i18n.store.ts
import { createI18n } from "./i18n.js";
import type { LanguageCode, TranslationDictionary } from "./i18n.js";

// Default bootstrap language (minimal and safe)
const i18n = createI18n({
  language: "en-GB",
  fallback: "en-GB",
  translations: {
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
  } as Partial<Record<LanguageCode, TranslationDictionary>> as Record<
    LanguageCode,
    TranslationDictionary
  >,
});

export const getTranslator = () => i18n;

export async function loadLanguage(lang: LanguageCode): Promise<void> {
  const res = await fetch(`/i18n/${lang}`);
  if (!res.ok) throw new Error(`Failed to load translations for ${lang}`);
  const dict = (await res.json()) as TranslationDictionary;

  i18n.loadTranslations(lang, dict);
  i18n.setLanguage(lang);

  // Optionally store preference
  localStorage.setItem("userLang", lang);
}

// Restore language on app load (optional)
const savedLang = localStorage.getItem("userLang") as LanguageCode | null;
if (savedLang && savedLang !== "en-GB") {
  loadLanguage(savedLang).catch(() => {
    console.warn(`Could not reload saved language: ${savedLang}`);
  });
}
