import { describe, it, expect, beforeEach } from "vitest";
import {
  createI18n,
  type I18nConfig,
  type TranslationDictionary,
} from "../src/i18n/i18n";

const enGB: TranslationDictionary = {
  hello: "Hello",
  welcome: "Welcome {name}, you have {count} messages",
  greet: ({ name }) => `Hi ${String(name)}!`,
};

const frFR: TranslationDictionary = {
  hello: "Bonjour",
  welcome: "Bienvenue {name}, vous avez {count} messages",
  greet: ({ name }) => `Salut ${String(name)} !`,
};

const ar: TranslationDictionary = {
  hello: "مرحبا",
  welcome: "مرحبًا {name}، لديك {count} رسائل",
  greet: ({ name }) => `أهلًا ${String(name)}`,
};

let config: I18nConfig;

beforeEach(() => {
  config = {
    language: "en-GB",
    fallback: "en-GB",
    translations: {
      "en-GB": enGB,
      "fr-FR": frFR,
      ar,
    },
  };
});

describe("i18n", () => {
  it("initializes with provided language and exposes t()", () => {
    const i18n = createI18n(config);
    const str = i18n.t("hello");
    expect(i18n.language).toBe("en-GB");
    expect(i18n.direction).toBe("ltr");
    expect(str).toBe("Hello");
  });

  it("supports string interpolation with provided args", () => {
    const i18n = createI18n(config);
    const result = i18n.t("welcome", { name: "Ada", count: 3 });
    expect(result).toBe("Welcome Ada, you have 3 messages");
  });

  it("leaves unknown placeholders intact when arg not provided", () => {
    const i18n = createI18n(config);
    const result = i18n.t("welcome", { name: "Ada" });
    expect(result).toBe("Welcome Ada, you have {count} messages");
  });

  it("supports function-based translations", () => {
    const i18n = createI18n(config);
    const result = i18n.t("greet", { name: "Ada" });
    expect(result).toBe("Hi Ada!");
  });

  it("returns the key when translation is missing", () => {
    const i18n = createI18n(config);
    expect(i18n.t("__missing_key__")).toBe("__missing_key__");
  });

  it("setLanguage() switches language and direction", () => {
    const i18n = createI18n(config);
    i18n.setLanguage("fr-FR");
    expect(i18n.t("hello")).toBe("Bonjour");
    expect(i18n.direction).toBe("ltr");

    i18n.setLanguage("ar");
    expect(i18n.t("hello")).toBe("مرحبا");
    expect(i18n.direction).toBe("rtl");
  });

  it("loadTranslations() adds or replaces a language dictionary", () => {
    const i18n = createI18n(config);
    i18n.loadTranslations("es-ES", { hello: "Hola" });
    i18n.setLanguage("es-ES");
    expect(i18n.t("hello")).toBe("Hola");
  });

  it("falls back to the fallback language dictionary when current language has no dictionary", () => {
    const i18n = createI18n(config);
    // No "ja" dictionary in config; should use fallback (en-GB) for lookups
    i18n.setLanguage("ja");
    const str = i18n.t("hello");
    expect(str).toBe("Hello");
    // Direction is computed from the current language code, not the fallback
    expect(i18n.direction).toBe("ltr");
  });

  it("does not fall back per-key (only per-language)", () => {
    const i18n = createI18n({
      ...config,
      translations: {
        "en-GB": { hello: "Hello", onlyEnglish: "Only English" },
        "fr-FR": { hello: "Bonjour" },
      },
    });

    i18n.setLanguage("fr-FR");
    // "onlyEnglish" does not exist in fr-FR; implementation returns the key
    expect(i18n.t("onlyEnglish")).toBe("onlyEnglish");
  });
});
