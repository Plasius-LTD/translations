import { describe, it, expect, beforeEach } from "vitest";
import {
  createI18n,
  isValidLanguageCode,
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
  it.each(["zh-hant-hk", "i-klingon", "x-piglatin", "sl-rozaj-biske"])(
    "accepts the shared RFC 5646 subset: %s",
    (language) => {
      expect(isValidLanguageCode(language)).toBe(true);
    },
  );

  it.each(["", "en--GB", "not_a_tag", "en-u", "x"])(
    "rejects malformed language tags: %s",
    (language) => {
      expect(isValidLanguageCode(language)).toBe(false);
    },
  );

  it("rejects invalid language tags at each public mutation boundary", () => {
    expect(() => createI18n({ ...config, language: "en--GB" })).toThrow(/RFC 5646/u);
    expect(() => createI18n({ ...config, fallback: "not_a_tag" })).toThrow(/RFC 5646/u);
    expect(() => createI18n({
      ...config,
      translations: { ...config.translations, "en--GB": enGB },
    })).toThrow(/RFC 5646/u);

    const i18n = createI18n(config);
    expect(() => i18n.setLanguage("en--GB")).toThrow(/RFC 5646/u);
    expect(() => i18n.loadTranslations("not_a_tag", enGB)).toThrow(/RFC 5646/u);
    expect(() => i18n.loadBundleTranslations("x", "frontend/app-shell", enGB)).toThrow(/RFC 5646/u);
  });

  it("computes RTL direction case-insensitively for valid script subtags", () => {
    const i18n = createI18n({ ...config, language: "az-arab" });
    expect(i18n.direction).toBe("rtl");
  });

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

  it("loadBundleTranslations() merges bundle dictionaries in load order", () => {
    const i18n = createI18n(config);

    i18n.loadBundleTranslations("fr-FR", "frontend/app-shell", {
      shellTitle: "Console",
      sharedLabel: "Premier",
    });
    i18n.loadBundleTranslations("fr-FR", "frontend/routes/about", {
      aboutHeading: "A propos",
      sharedLabel: "Deuxieme",
    });
    i18n.setLanguage("fr-FR");

    expect(i18n.t("shellTitle")).toBe("Console");
    expect(i18n.t("aboutHeading")).toBe("A propos");
    expect(i18n.t("sharedLabel")).toBe("Deuxieme");
  });

  it("later bundle overlays do not remove keys loaded by earlier bundles", () => {
    const i18n = createI18n(config);

    i18n.loadBundleTranslations("fr-FR", "frontend/app-shell", {
      shellTitle: "Console",
      sharedLabel: "Premier",
    });
    i18n.loadBundleTranslations("fr-FR", "frontend/routes/about", {
      aboutHeading: "A propos",
    });
    i18n.setLanguage("fr-FR");

    expect(i18n.t("shellTitle")).toBe("Console");
    expect(i18n.t("aboutHeading")).toBe("A propos");
    expect(i18n.t("sharedLabel")).toBe("Premier");
  });

  it("tracks normalized loaded bundle paths per language", () => {
    const i18n = createI18n(config);

    i18n.loadBundleTranslations("fr-FR", "/frontend/app-shell/", {
      shellTitle: "Console",
    });

    expect(i18n.hasLoadedBundle("fr-FR", "frontend/app-shell")).toBe(true);
    expect(i18n.getLoadedBundlePaths("fr-FR")).toEqual(["frontend/app-shell"]);
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
