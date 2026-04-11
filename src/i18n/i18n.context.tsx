import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getTranslator, loadLanguage } from "./i18n.store.js";
import { normalizeBundlePath } from "./i18n.js";
import type { BundlePath, I18nState, LanguageCode } from "./i18n.js";

export type I18nReadyState = "idle" | "loading" | "ready" | "error";

export interface I18nContextValue extends I18nState {
  readonly readyState: I18nReadyState;
  readonly isReady: boolean;
  readonly requiredBundles: readonly BundlePath[];
  readonly error: Error | null;
}

interface I18nProviderProps {
  initialLang: LanguageCode;
  bundlePaths?: readonly BundlePath[];
  children: React.ReactNode;
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

function createContextValue(
  translator: I18nState,
  readyState: I18nReadyState,
  requiredBundles: readonly BundlePath[],
  error: Error | null
): I18nContextValue {
  return {
    language: translator.language,
    fallbackLanguage: translator.fallbackLanguage,
    direction: translator.direction,
    t: translator.t,
    setLanguage: translator.setLanguage,
    loadTranslations: translator.loadTranslations,
    loadBundleTranslations: translator.loadBundleTranslations,
    hasLoadedBundle: translator.hasLoadedBundle,
    getLoadedBundlePaths: translator.getLoadedBundlePaths,
    readyState,
    isReady: readyState === "ready",
    requiredBundles,
    error,
  };
}

const I18nContext = createContext<I18nContextValue>(
  createContextValue(getTranslator(), "idle", [], null)
);

export function I18nProvider({
  initialLang,
  bundlePaths = [],
  children,
}: I18nProviderProps) {
  const bundlePathKey = useMemo(() => bundlePaths.join("\u0000"), [bundlePaths]);
  const normalizedBundlePaths = useMemo(
    () => normalizeBundlePaths(bundlePaths),
    [bundlePathKey]
  );
  const normalizedBundlePathKey = normalizedBundlePaths.join("\u0000");
  const [contextValue, setContextValue] = useState<I18nContextValue>(() =>
    createContextValue(getTranslator(), "idle", normalizedBundlePaths, null)
  );
  const requestSequence = useRef(0);

  useEffect(() => {
    const requestId = ++requestSequence.current;
    let isCancelled = false;

    setContextValue(
      createContextValue(getTranslator(), "loading", normalizedBundlePaths, null)
    );

    void loadLanguage(initialLang, {
      bundlePaths: normalizedBundlePaths,
    })
      .then(() => {
        if (isCancelled || requestId !== requestSequence.current) {
          return;
        }

        setContextValue(
          createContextValue(getTranslator(), "ready", normalizedBundlePaths, null)
        );
      })
      .catch((err) => {
        if (isCancelled || requestId !== requestSequence.current) {
          return;
        }

        const error = err instanceof Error ? err : new Error(String(err));
        console.error("Failed to load language:", error);
        setContextValue(
          createContextValue(
            getTranslator(),
            "error",
            normalizedBundlePaths,
            error
          )
        );
      });

    return () => {
      isCancelled = true;
    };
  }, [initialLang, normalizedBundlePathKey]);

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
