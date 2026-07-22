"use client";

import { useEffect } from "react";

// Лечит «мёртвое» приложение после сворачивания в установленной PWA.
//
// На iOS standalone-приложение при уходе в фон система замораживает (а нередко
// и убивает) процесс страницы. При возврате показывается «снимок»: вёрстка
// видна, но JavaScript не исполняется — кнопки (бургер) не реагируют. В обычном
// Safari такого нет, потому что вкладка сама перезагружается; в установленном
// приложении — нет, поэтому баг был виден только «в приложении».
//
// Решение: при возврате из фона перезагрузить страницу. Сессия в httpOnly-cookie
// живёт 7 дней, поэтому reload не разлогинивает — только поднимает свежий JS и
// актуальные данные. Заодно уходит проблема устаревшего экрана.
export function PwaResumeGuard() {
  useEffect(() => {
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari: собственный флаг для «Добавлено на экран Домой»
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;

    // В обычном браузере вкладка перезагружается сама — вмешиваться не нужно.
    if (!isStandalone) return;

    let hiddenAt: number | null = null;
    // Порог: короткие переключения (глянуть уведомление) не должны дёргать
    // перезагрузку. 60с достаточно, чтобы отсечь их, но поймать реальный
    // возврат после заморозки.
    const RELOAD_AFTER_HIDDEN_MS = 60_000;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      // стало видимым
      if (hiddenAt && Date.now() - hiddenAt > RELOAD_AFTER_HIDDEN_MS) {
        window.location.reload();
      }
      hiddenAt = null;
    };

    // bfcache-восстановление (persisted) — верный признак, что процесс был
    // заморожен и JS-состояние неактуально.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return null;
}
