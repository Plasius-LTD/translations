import { vi } from "vitest";

/**
 * Sets up a mock for `../src/i18n/i18n` that captures the arguments passed to
 * `createI18n` and returns a stable mocked i18n instance.
 *
 * Usage in tests:
 *   const { loadTranslations, setLanguage, t, getLastCreateArgs } = setupI18nMock();
 *   const mod = await import("../src/i18n/i18n.store");
 */
export function setupI18nMock() {
  const loadTranslations = vi.fn();
  const setLanguage = vi.fn();
  const t = vi.fn((key: string) => key);

  let lastCreateArgs: any = null;

  // Ensure a fresh mock factory is registered for this module id.
  // Path is relative to THIS helper file: tests/helpers -> ../../src/i18n/i18n
  vi.doMock("../../src/i18n/i18n", () => ({
    createI18n: vi.fn((cfg: any) => {
      lastCreateArgs = cfg;
      return { loadTranslations, setLanguage, t };
    }),
  }));

  return {
    loadTranslations,
    setLanguage,
    t,
    getLastCreateArgs: () => lastCreateArgs,
  } as const;
}
