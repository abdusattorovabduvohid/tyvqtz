"use client";

import { notifications } from "@mantine/notifications";
import { DEFAULT_LANG, translate, type Lang } from "@/lib/i18n/translations";

/**
 * Язык интерфейса вне React-дерева.
 *
 * Хук useI18n здесь недоступен, но <html lang> всегда актуален: его ставит
 * сервер и переключает I18nProvider. Отдельное состояние заводить не нужно.
 */
function currentLang(): Lang {
  const lang = typeof document === "undefined" ? "" : document.documentElement.lang;
  return lang === "ru" || lang === "uz" ? lang : DEFAULT_LANG;
}

/** Тонкая обёртка над fetch для клиентских компонентов. */
export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new Error(
      data?.error || translate(currentLang(), "common.requestFailed", { code: res.status })
    );
  }
  return data as T;
}

/**
 * Показать пользователю ошибку из catch.
 *
 * В catch прилетает unknown, и это не обязательно Error: оборванная сеть,
 * отменённый промис, объект из чужой библиотеки. Раньше каждый обработчик
 * писался как `catch (e: any)` и читал `.message` вслепую — на нестандартном
 * значении сотрудник видел в уведомлении «undefined» и не понимал, что
 * случилось. Здесь тип разбирается один раз, и всегда есть запасной текст.
 */
export function showError(e: unknown, title?: string): void {
  const message = e instanceof Error && e.message ? e.message : String(e ?? "");
  notifications.show({
    color: "red",
    title,
    message: message || translate(currentLang(), "common.error"),
  });
}
