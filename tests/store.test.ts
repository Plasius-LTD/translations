import { describe, it, expect, beforeEach, vi } from "vitest";
import { setupI18nMock } from "./helpers/mocki18n";

let loadTranslations: ReturnType<typeof vi.fn>;
let setLanguage: ReturnType<typeof vi.fn>;
let getLastCreateArgs: () => any;

({ loadTranslations, setLanguage, getLastCreateArgs } = setupI18nMock());

// Helpers to import the module fresh each test and to access its exports
async function importStore() {
  vi.resetModules();
  ({ loadTranslations, setLanguage, getLastCreateArgs } = setupI18nMock());
  return await import("../src/i18n/i18n.store");
}

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom provides localStorage; reset it between tests
  window.localStorage.clear();
  // reset global fetch
  // @ts-expect-error allow reassignment in tests
  global.fetch = undefined;
});

describe("i18n.store bootstrap", () => {
  it("initialises i18n with default language, fallback and minimal translations", async () => {
    const { getTranslator } = await importStore();

    const cfg = getLastCreateArgs();
    expect(cfg).toBeTruthy();
    expect(cfg.language).toBe("en-GB");
    expect(cfg.fallback).toBe("en-GB");
    expect(cfg.translations["en-GB"]).toEqual({
      loading: "Loading...",
    });

    const i18n = getTranslator();
    expect(i18n).toBeDefined();
    // `t` should be coming from our stub and be callable
    expect(i18n.t("loading")).toBe("loading");
  });

  it("getTranslator returns the same singleton instance", async () => {
    const { getTranslator } = await importStore();
    const a = getTranslator();
    const b = getTranslator();
    expect(a).toBe(b);
  });
});

describe("loadLanguage()", () => {
  it("fetches translations, loads them, switches language, and stores preference", async () => {
    const { loadLanguage } = await importStore();

    const dict = { hello: "Bonjour" };
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => dict });

    global.fetch = fetchMock;

    await loadLanguage("fr-FR" as any);

    expect(fetchMock).toHaveBeenCalledWith("/i18n/fr-FR");
    expect(loadTranslations).toHaveBeenCalledWith("fr-FR", dict);
    expect(setLanguage).toHaveBeenCalledWith("fr-FR");
  });

  it("throws if fetch is not ok and does not call i18n methods", async () => {
    const { loadLanguage } = await importStore();
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });

    global.fetch = fetchMock;

    await expect(loadLanguage("de" as any)).rejects.toThrow(/Failed to load/);
    expect(loadTranslations).not.toHaveBeenCalled();
    expect(setLanguage).not.toHaveBeenCalled();
  });
});

describe("auto-restore saved language on module load", () => {
  it("calls loadLanguage for a saved non-default language", async () => {
    window.localStorage.setItem("userLang", "es-ES");

    const dict = { loading: "Cargando..." };
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => dict });

    global.fetch = fetchMock;

    // Import module so top-level side-effect runs
    await importStore();

    // Wait a tick for the async call scheduled by module side-effect
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchMock).toHaveBeenCalledWith("/i18n/es-ES");
    expect(loadTranslations).toHaveBeenCalledWith("es-ES", dict);
    expect(setLanguage).toHaveBeenCalledWith("es-ES");
  });

  it("does not fetch when saved language is the default en-GB", async () => {
    window.localStorage.setItem("userLang", "en-GB");

    const fetchMock = vi.fn();

    global.fetch = fetchMock;

    await importStore();
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(loadTranslations).not.toHaveBeenCalled();
    expect(setLanguage).not.toHaveBeenCalled();
  });

  it("logs a warning if reload fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    window.localStorage.setItem("userLang", "ja");
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });

    global.fetch = fetchMock;

    await importStore();
    await new Promise((r) => setTimeout(r, 0));

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Could not reload saved language")
    );
    warn.mockRestore();
  });
});
