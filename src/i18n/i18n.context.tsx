// i18n.context.ts
import React, { createContext, useContext, useEffect, useState } from "react";
import { getTranslator, loadLanguage } from "./i18n.store.js";
import type { I18nState, LanguageCode } from "./i18n.js";

const I18nContext = createContext<I18nState>(getTranslator());

interface I18nProviderProps {
  initialLang: LanguageCode;
  children: React.ReactNode;
}

export function I18nProvider({ initialLang, children } : I18nProviderProps) {
  const [translator, setTranslator] = useState<I18nState>(getTranslator());

  useEffect(() => {
    void loadLanguage(initialLang)
      .then(() => setTranslator(getTranslator()))
      .catch((err) => {
        console.error("Failed to load language:", err);
      });
  }, [initialLang]);

  return (
    <I18nContext.Provider value={translator}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
