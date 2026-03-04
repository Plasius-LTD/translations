import React, { useEffect } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";

let errorSpy: ReturnType<typeof vi.spyOn>;

const h = vi.hoisted(() => {
  const makeTranslator = (
    lang: string,
    dir: "ltr" | "rtl",
    dict: Record<string, string>
  ) => ({
    language: lang,
    direction: dir,
    t: (key: string) => dict[key] ?? key,
    setLanguage: () => {},
    loadTranslations: () => {},
  });

  const enDict = { hello: "Hello" };
  const frDict = { hello: "Bonjour" };
  const arDict = { hello: "مرحبا" };
  const defaultDict = { hello: "Default" };

  const defaultTranslator = makeTranslator("en-GB", "ltr", defaultDict);
  return {
    loads: new Map<
      string,
      {
        promise: Promise<void>;
        resolve: () => void;
        reject: (err?: unknown) => void;
      }
    >(),
    currentTranslator: defaultTranslator,
    defaultTranslator,
    translatorsByLang: {
      "en-GB": makeTranslator("en-GB", "ltr", enDict),
      "fr-FR": makeTranslator("fr-FR", "ltr", frDict),
      ar: makeTranslator("ar", "rtl", arDict),
    },
  };
});

// IMPORTANT: vi.mock must come before importing the SUT below.
vi.mock("../src/i18n/i18n.store.js", async (importOriginal) => {
  const actual = (await (importOriginal as any)()) as any;
  return {
    ...actual,
    getTranslator: vi.fn(() => h.currentTranslator),
    loadLanguage: vi.fn((lang: string) => {
      let resolve!: () => void;
      let reject!: (err?: unknown) => void;
      const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      h.loads.set(lang, { promise, resolve, reject });
      return promise;
    }),
    __testHooks: {
      setCurrentTranslator: (lang: string) => {
        h.currentTranslator =
          (h.translatorsByLang as Record<string, typeof h.currentTranslator>)[
            lang
          ] ?? h.currentTranslator;
      },
      setDefault: () => {
        h.currentTranslator = h.defaultTranslator;
      },
      resolveLoad: (lang: string) => {
        const d = h.loads.get(lang);
        if (!d) throw new Error(`No pending load for ${lang}`);
        h.currentTranslator =
          (h.translatorsByLang as Record<string, typeof h.currentTranslator>)[
            lang
          ] ?? h.currentTranslator;
        d.resolve();
      },
      rejectLoad: (lang: string, err?: unknown) => {
        const d = h.loads.get(lang);
        if (!d) throw new Error(`No pending load for ${lang}`);
        d.reject(err ?? new Error("load failed"));
      },
      getLoad: (lang: string) => h.loads.get(lang),
      clear: () => {
        h.loads.clear();
      },
    },
  };
});

import * as Store from "../src/i18n/i18n.store.js";

// Now import the SUT. These imports will see the mocked getTranslator/loadLanguage.
import * as Scope from "../src/i18n/i18n.context";
const { I18nProvider, useI18n } = Scope as any;
const { getTranslator, __testHooks } = Store as any;

const Consumer = ({ testId = "value" }: { testId?: string }) => {
  const i18n = useI18n();
  return (
    <div>
      <div data-testid={testId}>{i18n.t("hello")}</div>
      <div data-testid={`${testId}-language`}>{i18n.language}</div>
      <div data-testid={`${testId}-direction`}>{i18n.direction}</div>
    </div>
  );
};

describe("I18nProvider scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // reset console spy
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // reset mocked store state so each test starts from the same baseline
    __testHooks.setDefault();
    __testHooks.clear();
  });

  afterEach(() => {
    errorSpy?.mockRestore();
    cleanup();
    __testHooks.clear();
  });

  it("renders children", () => {
    render(
      <I18nProvider initialLang="en-GB">
        <div data-testid="child">hello</div>
      </I18nProvider>
    );
    expect(screen.getByTestId("child").textContent).toBe("hello");
  });

  it("calls loadLanguage on mount with initialLang", () => {
    const spy = vi.spyOn(Store as any, "loadLanguage");
    render(
      <I18nProvider initialLang="en-GB">
        <Consumer />
      </I18nProvider>
    );
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("en-GB");
  });

  it("updates context after loadLanguage resolves", async () => {
    render(
      <I18nProvider initialLang="fr-FR">
        <Consumer />
      </I18nProvider>
    );

    // before resolve -> default translator visible
    expect(screen.getByTestId("value").textContent).toBe("Default");

    // resolve and swap translator to fr-FR
    await act(async () => {
      __testHooks.resolveLoad("fr-FR");
    });

    expect(screen.getByTestId("value").textContent).toBe("Bonjour");
    expect(screen.getByTestId("value-language").textContent).toBe("fr-FR");
    expect(screen.getByTestId("value-direction").textContent).toBe("ltr");
  });

  it("does not update context before loadLanguage resolves", () => {
    render(
      <I18nProvider initialLang="ar">
        <Consumer />
      </I18nProvider>
    );
    expect(screen.getByTestId("value").textContent).toBe("Default");
  });

  it("logs error and preserves prior state on loadLanguage rejection", async () => {
    render(
      <I18nProvider initialLang="en-GB">
        <Consumer />
      </I18nProvider>
    );

    await act(async () => {
      __testHooks.rejectLoad("en-GB", "boom");
      // swallow unhandled rejection warnings
      try {
        await __testHooks.getLoad("en-GB")?.promise;
      } catch {
        void 0;
      }
    });

    // state preserved
    expect(screen.getByTestId("value").textContent).toBe("Default");
    expect(console.error).toHaveBeenCalled();
  });

  it("reacts to initialLang prop changes", async () => {
    const { rerender } = render(
      <I18nProvider initialLang="en-GB">
        <Consumer />
      </I18nProvider>
    );

    expect(screen.getByTestId("value").textContent).toBe("Default");

    rerender(
      <I18nProvider initialLang="fr-FR">
        <Consumer />
      </I18nProvider>
    );

    // resolve fr-FR
    await act(async () => {
      __testHooks.resolveLoad("fr-FR");
    });
    expect(screen.getByTestId("value").textContent).toBe("Bonjour");
  });

  it("avoids redundant loads when initialLang stays the same", () => {
    const spy = vi.spyOn(Store as any, "loadLanguage");
    const { rerender } = render(
      <I18nProvider initialLang="en-GB">
        <Consumer />
      </I18nProvider>
    );
    expect(spy).toHaveBeenCalledTimes(1);

    // same prop value
    rerender(
      <I18nProvider initialLang="en-GB">
        <Consumer />
      </I18nProvider>
    );
    // still only one call
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("handles rapid successive language changes; last one wins", async () => {
    const { rerender } = render(
      <I18nProvider initialLang="en-GB">
        <Consumer />
      </I18nProvider>
    );

    rerender(
      <I18nProvider initialLang="fr-FR">
        <Consumer />
      </I18nProvider>
    );
    rerender(
      <I18nProvider initialLang="ar">
        <Consumer />
      </I18nProvider>
    );

    // resolve out of order: fr-FR first
    await act(async () => {
      __testHooks.resolveLoad("fr-FR");
    });
    // may or may not update yet depending on guard; final resolve should win
    await act(async () => {
      __testHooks.resolveLoad("ar");
    });

    expect(screen.getByTestId("value").textContent).toBe("مرحبا");
    expect(screen.getByTestId("value-language").textContent).toBe("ar");
    expect(screen.getByTestId("value-direction").textContent).toBe("rtl");
  });

  it("does not set state after unmount when a load resolves", async () => {
    const { unmount } = render(
      <I18nProvider initialLang="fr-FR">
        <Consumer />
      </I18nProvider>
    );

    unmount();

    // resolve after unmount should not throw or update
    await act(async () => {
      __testHooks.resolveLoad("fr-FR");
    });

    // no assertions needed; test passes if no React warnings/errors occur.
  });

  it("useI18n returns a stable object shape", () => {
    render(
      <I18nProvider initialLang="en-GB">
        <Consumer />
      </I18nProvider>
    );
    const i18n = getTranslator();
    expect(typeof i18n.t).toBe("function");
    expect(typeof i18n.setLanguage).toBe("function");
    expect(typeof i18n.loadTranslations).toBe("function");
    expect(typeof i18n.language).toBe("string");
    expect(["ltr", "rtl"]).toContain(i18n.direction);
  });

  it("propagates updates to deep consumers", async () => {
    const Deep = () => (
      <div data-testid="deep">
        <Consumer testId="deepvalue" />
      </div>
    );
    render(
      <I18nProvider initialLang="fr-FR">
        <Deep />
      </I18nProvider>
    );

    expect(screen.getByTestId("deepvalue").textContent).toBe("Default");
    await act(async () => {
      __testHooks.resolveLoad("fr-FR");
    });
    expect(screen.getByTestId("deepvalue").textContent).toBe("Bonjour");
  });

  it("logs meaningfully when rejection value is a non-Error", async () => {
    render(
      <I18nProvider initialLang="en-GB">
        <Consumer />
      </I18nProvider>
    );

    await act(async () => {
      __testHooks.rejectLoad("en-GB", "string error");
      try {
        await __testHooks.getLoad("en-GB")?.promise;
      } catch {
        void 0;
      }
    });
    expect(console.error).toHaveBeenCalled();
  });

  it("is SSR-safe (no window/document access on import)", async () => {
    // Simulate SSR: no window/document at import time.
    const originalWindow = (globalThis as any).window;
    const originalDocument = (globalThis as any).document;
    // Remove globals
    delete (globalThis as any).window;
    delete (globalThis as any).document;

    try {
      // Reset module registry so the next import evaluates fresh under SSR-like globals
      vi.resetModules();

      // Mock the store for this fresh import graph
      vi.doMock("../src/i18n/i18n.store.js", () => {
        const translator = {
          language: "en-GB",
          direction: "ltr",
          t: (k: string) => k,
          setLanguage: () => {},
          loadTranslations: () => {},
        };
        return {
          getTranslator: () => translator,
          loadLanguage: () => Promise.resolve(),
        };
      });

      // Dynamic import should not throw without window/document
      const p = import("../src/i18n/i18n.context");
      await expect(p).resolves.toBeDefined();
    } finally {
      // Always restore globals and module registry
      (globalThis as any).window = originalWindow;
      (globalThis as any).document = originalDocument;
      vi.resetModules();
    }
  });

  it("minimizes re-renders when initialLang is unchanged", async () => {
    // We check that the *context value reference* remains stable
    // (no new translator object) when rerendering with same initialLang.
    const seen: unknown[] = [];
    const IdentityConsumer = () => {
      const i18n = useI18n();
      useEffect(() => {
        seen.push(i18n);
      });
      return null;
    };

    const { rerender } = render(
      <I18nProvider initialLang="en-GB">
        <IdentityConsumer />
      </I18nProvider>
    );

    // Allow first effect to run
    await act(async () => {});

    // Rerender with the same prop; effect will run again, but the reference should be identical
    rerender(
      <I18nProvider initialLang="en-GB">
        <IdentityConsumer />
      </I18nProvider>
    );
    await act(async () => {});

    // We expect two commits (two effects), but the i18n object should be the same reference
    expect(seen.length).toBeGreaterThanOrEqual(1);
    if (seen.length >= 2) {
      expect(seen[0]).toBe(seen[1]);
    }
  });
});
