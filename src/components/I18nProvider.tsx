"use client";

import { createContext, useContext, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  translate,
  DEFAULT_LANG,
  type Lang,
} from "@/lib/i18n/translations";

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  initialLang,
  children,
}: {
  initialLang: Lang;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback(
    (l: Lang) => {
      setLangState(l);
      // на год, чтобы серверные компоненты тоже знали язык
      document.cookie = `lang=${l}; path=/; max-age=${60 * 60 * 24 * 365}`;
      document.documentElement.lang = l;
      router.refresh(); // обновить серверные компоненты
    },
    [router]
  );

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(lang, key, params),
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n должен использоваться внутри I18nProvider");
  return ctx;
}
