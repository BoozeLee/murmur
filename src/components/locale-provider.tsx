"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  CATEGORY_LABELS_NL,
  DEFAULT_LOCALE,
  isLocale,
  LOCALES,
  type Locale,
  MESSAGES,
  type MessageKey,
  TAG_LABELS_NL,
} from "@/lib/i18n";
import { CATEGORY_LABELS, type Category, type Tag } from "@/lib/schema";

const STORAGE_KEY = "murmur.locale";

interface I18n {
  locale: Locale;
  setLocale: (next: Locale) => void;
  toggleLocale: () => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
  categoryLabel: (category: Category) => string;
  tagLabel: (tag: Tag) => string;
}

const LocaleContext = createContext<I18n | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) setLocaleState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);
  const toggleLocale = useCallback(
    () => setLocaleState((current) => (current === "en" ? "nl" : "en")),
    [],
  );

  const value = useMemo<I18n>(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      t: (key, values) => {
        const template = MESSAGES[locale][key];
        if (values === undefined) return template;
        return template.replace(/\{(\w+)\}/g, (match, name: string) =>
          String(values[name] ?? match),
        );
      },
      categoryLabel: (category) =>
        locale === "nl" ? CATEGORY_LABELS_NL[category] : CATEGORY_LABELS[category],
      tagLabel: (tag) => (locale === "nl" ? (TAG_LABELS_NL[tag] ?? tag) : tag),
    }),
    [locale, setLocale, toggleLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(LocaleContext);
  if (value === null) throw new Error("useI18n must be used inside LocaleProvider");
  return value;
}

export { LOCALES };
