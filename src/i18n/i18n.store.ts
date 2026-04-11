import { createI18n, normalizeBundlePath } from "./i18n.js";
import type { BundlePath, LanguageCode, TranslationDictionary } from "./i18n.js";

const DEFAULT_LANGUAGE = "en-GB";
const LEGACY_LANGUAGE_ENDPOINT = "/i18n";
const PAGE_BUNDLE_ENDPOINT = "/language";

interface CachedBundleRecord {
  readonly bundlePath: BundlePath;
  readonly dictionary: TranslationDictionary;
  readonly sourceLanguage: LanguageCode;
  readonly usedFallback: boolean;
}

export interface LoadLanguageOptions {
  readonly bundlePaths?: readonly BundlePath[];
  readonly forceReload?: boolean;
}

export interface LoadLanguageResult {
  readonly language: LanguageCode;
  readonly fallbackLanguage: LanguageCode;
  readonly bundlePaths: readonly BundlePath[];
  readonly readyBundlePaths: readonly BundlePath[];
  readonly fallbackBundlePaths: readonly BundlePath[];
}

const i18n = createI18n({
  language: DEFAULT_LANGUAGE,
  fallback: DEFAULT_LANGUAGE,
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
  },
});

const bundleCache = new Map<string, CachedBundleRecord>();
const inFlightBundleRequests = new Map<string, Promise<CachedBundleRecord>>();

function createBundleCacheKey(lang: LanguageCode, bundlePath: BundlePath): string {
  return `${lang}::${bundlePath}`;
}

function buildLegacyLanguageUrl(lang: LanguageCode): string {
  return `${LEGACY_LANGUAGE_ENDPOINT}/${encodeURIComponent(lang)}`;
}

function buildBundleUrl(lang: LanguageCode, bundlePath: BundlePath): string {
  const encodedSegments = bundlePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${PAGE_BUNDLE_ENDPOINT}/${encodeURIComponent(lang)}/${encodedSegments}`;
}

function isTranslationDictionary(value: unknown): value is TranslationDictionary {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function persistLanguagePreference(lang: LanguageCode): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem("userLang", lang);
  } catch {
    // Ignore storage failures so translation loading remains functional.
  }
}

function readSavedLanguagePreference(): LanguageCode | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  try {
    return (localStorage.getItem("userLang") as LanguageCode | null) ?? null;
  } catch {
    return null;
  }
}

async function readDictionaryResponse(
  response: Response,
  description: string
): Promise<TranslationDictionary> {
  const payload = (await response.json()) as unknown;
  if (!isTranslationDictionary(payload)) {
    throw new Error(`${description} did not return a translation dictionary`);
  }

  return payload;
}

async function fetchBundleRecordFromNetwork(
  lang: LanguageCode,
  bundlePath: BundlePath,
  description: string,
  usedFallback: boolean
): Promise<CachedBundleRecord> {
  const response = await fetch(buildBundleUrl(lang, bundlePath));
  if (!response.ok) {
    throw new Error(`${description} failed with status ${response.status}`);
  }

  const dictionary = await readDictionaryResponse(response, description);
  const record: CachedBundleRecord = {
    bundlePath,
    dictionary,
    sourceLanguage: lang,
    usedFallback,
  };
  bundleCache.set(createBundleCacheKey(lang, bundlePath), record);
  return record;
}

async function fetchBundleRecord(
  lang: LanguageCode,
  bundlePath: BundlePath,
  forceReload = false
): Promise<CachedBundleRecord> {
  const cacheKey = createBundleCacheKey(lang, bundlePath);
  if (!forceReload) {
    const cachedRecord = bundleCache.get(cacheKey);
    if (cachedRecord) {
      return cachedRecord;
    }

    const inFlightRequest = inFlightBundleRequests.get(cacheKey);
    if (inFlightRequest) {
      return inFlightRequest;
    }
  }

  const request = (async () => {
    const primaryResponse = await fetch(buildBundleUrl(lang, bundlePath));
    if (primaryResponse.ok) {
      const dictionary = await readDictionaryResponse(
        primaryResponse,
        `Translation bundle ${bundlePath} for ${lang}`
      );
      const record: CachedBundleRecord = {
        bundlePath,
        dictionary,
        sourceLanguage: lang,
        usedFallback: false,
      };
      bundleCache.set(cacheKey, record);
      return record;
    }

    if (primaryResponse.status === 404 && lang !== DEFAULT_LANGUAGE) {
      const fallbackKey = createBundleCacheKey(DEFAULT_LANGUAGE, bundlePath);
      if (!forceReload) {
        const fallbackCachedRecord = bundleCache.get(fallbackKey);
        if (fallbackCachedRecord) {
          const record = {
            ...fallbackCachedRecord,
            usedFallback: true,
          };
          bundleCache.set(cacheKey, record);
          return record;
        }
      }

      const fallbackRecord = await fetchBundleRecordFromNetwork(
        DEFAULT_LANGUAGE,
        bundlePath,
        `Fallback translation bundle ${bundlePath} for ${DEFAULT_LANGUAGE}`,
        true
      );
      const record = {
        ...fallbackRecord,
        usedFallback: true,
      };
      bundleCache.set(cacheKey, record);
      return record;
    }

    throw new Error(
      `Failed to load translation bundle ${bundlePath} for ${lang}: ${primaryResponse.status}`
    );
  })().finally(() => {
    inFlightBundleRequests.delete(cacheKey);
  });

  inFlightBundleRequests.set(cacheKey, request);
  return request;
}

function normalizeBundlePaths(bundlePaths: readonly BundlePath[]): BundlePath[] {
  const normalizedPaths: BundlePath[] = [];
  const seenPaths = new Set<string>();

  for (const bundlePath of bundlePaths) {
    const normalizedPath = normalizeBundlePath(bundlePath);
    if (seenPaths.has(normalizedPath)) {
      continue;
    }

    seenPaths.add(normalizedPath);
    normalizedPaths.push(normalizedPath);
  }

  return normalizedPaths;
}

export const getTranslator = () => i18n;

export async function loadLanguage(
  lang: LanguageCode,
  options: LoadLanguageOptions = {}
): Promise<LoadLanguageResult> {
  const normalizedBundlePaths = normalizeBundlePaths(options.bundlePaths ?? []);

  if (normalizedBundlePaths.length === 0) {
    const response = await fetch(buildLegacyLanguageUrl(lang));
    if (!response.ok) {
      throw new Error(`Failed to load translations for ${lang}`);
    }

    const dictionary = await readDictionaryResponse(
      response,
      `Translations for ${lang}`
    );
    i18n.loadTranslations(lang, dictionary);
    i18n.setLanguage(lang);
    persistLanguagePreference(lang);

    return {
      language: lang,
      fallbackLanguage: DEFAULT_LANGUAGE,
      bundlePaths: [],
      readyBundlePaths: [],
      fallbackBundlePaths: [],
    };
  }

  const bundleResults = await Promise.all(
    normalizedBundlePaths.map((bundlePath) =>
      fetchBundleRecord(lang, bundlePath, options.forceReload ?? false)
    )
  );

  for (const [index, bundlePath] of normalizedBundlePaths.entries()) {
    const bundleRecord = bundleResults[index];
    if (!bundleRecord) {
      throw new Error(`Missing translation bundle result for ${bundlePath}`);
    }

    i18n.loadBundleTranslations(lang, bundlePath, bundleRecord.dictionary);
  }

  i18n.setLanguage(lang);
  persistLanguagePreference(lang);

  return {
    language: lang,
    fallbackLanguage: DEFAULT_LANGUAGE,
    bundlePaths: normalizedBundlePaths,
    readyBundlePaths: normalizedBundlePaths,
    fallbackBundlePaths: bundleResults
      .filter((record) => record.usedFallback)
      .map((record) => record.bundlePath),
  };
}

export const __testHooks = {
  clearBundleCache(): void {
    bundleCache.clear();
    inFlightBundleRequests.clear();
  },
  getBundleCacheKeys(): string[] {
    return [...bundleCache.keys()].sort();
  },
};

const savedLang = readSavedLanguagePreference();
if (savedLang && savedLang !== DEFAULT_LANGUAGE) {
  loadLanguage(savedLang).catch(() => {
    console.warn(`Could not reload saved language: ${savedLang}`);
  });
}
