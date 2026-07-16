import { cookies } from "next/headers";
import {
  translate,
  pickName,
  DEFAULT_LANG,
  type Lang,
  type BilingualName,
} from "./translations";

// Текущий язык из cookie (для серверных компонентов).
export function getLang(): Lang {
  const v = cookies().get("lang")?.value;
  return v === "uz" || v === "ru" ? v : DEFAULT_LANG;
}

// Серверный аналог t().
export function getServerT() {
  const lang = getLang();
  return (key: string, params?: Record<string, string | number>) =>
    translate(lang, key, params);
}

// Серверный выбор названия по текущему языку.
export function getServerName(o: BilingualName | null | undefined): string {
  return pickName(o, getLang());
}
