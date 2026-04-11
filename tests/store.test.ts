import { describe, it, expect, beforeEach, vi } from "vitest";
import { setupI18nMock } from "./helpers/mocki18n";

let loadTranslations: ReturnType<typeof vi.fn>;
let loadBundleTranslations: ReturnType<typeof vi.fn>;
let setLanguage: ReturnType<typeof vi.fn>;
let getLastCreateArgs: () => any;

({
  loadTranslations,
  loadBundleTranslations,
  setLanguage,
  getLastCreateArgs,
} = setupI18nMock());

// Helpers to import the module fresh each test and to access its exports
async function importStore() {
  vi.resetModules();
  ({
    loadTranslations,
    loadBundleTranslations,
    setLanguage,
    getLastCreateArgs,
  } = setupI18nMock());
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

  it("loads requested bundle paths in order and switches language", async () => {
    const { loadLanguage } = await importStore();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ shellTitle: "Bonjour" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ aboutHeading: "A propos" }),
      });

    global.fetch = fetchMock;

    const result = await loadLanguage("fr-FR", {
      bundlePaths: ["frontend/app-shell", "frontend/routes/about"],
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/language/fr-FR/frontend/app-shell"
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/language/fr-FR/frontend/routes/about"
    );
    expect(loadBundleTranslations).toHaveBeenNthCalledWith(
      1,
      "fr-FR",
      "frontend/app-shell",
      { shellTitle: "Bonjour" }
    );
    expect(loadBundleTranslations).toHaveBeenNthCalledWith(
      2,
      "fr-FR",
      "frontend/routes/about",
      { aboutHeading: "A propos" }
    );
    expect(setLanguage).toHaveBeenCalledWith("fr-FR");
    expect(result.bundlePaths).toEqual([
      "frontend/app-shell",
      "frontend/routes/about",
    ]);
  });

  it("falls back to en-GB for bundle paths that are unavailable in the requested locale", async () => {
    const { loadLanguage } = await importStore();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ shellTitle: "Hello" }),
      });

    global.fetch = fetchMock;

    const result = await loadLanguage("fr-FR", {
      bundlePaths: ["frontend/app-shell"],
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/language/fr-FR/frontend/app-shell"
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/language/en-GB/frontend/app-shell"
    );
    expect(loadBundleTranslations).toHaveBeenCalledWith(
      "fr-FR",
      "frontend/app-shell",
      { shellTitle: "Hello" }
    );
    expect(result.fallbackBundlePaths).toEqual(["frontend/app-shell"]);
  });

  it("caches bundle fetches by locale and logical path", async () => {
    const { loadLanguage, __testHooks } = await importStore();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ shellTitle: "Hello" }),
    });

    global.fetch = fetchMock;

    await loadLanguage("fr-FR", {
      bundlePaths: ["frontend/app-shell", "frontend/app-shell/"],
    });
    await loadLanguage("fr-FR", {
      bundlePaths: ["frontend/app-shell"],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(__testHooks.getBundleCacheKeys()).toEqual([
      "fr-FR::frontend/app-shell",
    ]);
  });

  it("rejects invalid bundle paths before attempting to fetch", async () => {
    const { loadLanguage } = await importStore();

    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    await expect(
      loadLanguage("fr-FR", { bundlePaths: ["../unsafe"] })
    ).rejects.toThrow(/invalid segment/i);
    expect(fetchMock).not.toHaveBeenCalled();
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
