"use client";

import { useEffect } from "react";

// Регистрирует /sw.js. Ничего не рендерит.
// В dev не регистрируем: Next в режиме разработки постоянно пересобирает
// чанки, а закешированная статика приводит к «залипшим» страницам.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // после load, чтобы регистрация не конкурировала за сеть с первым рендером
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW — прогрессивное улучшение: без него сайт работает как обычно
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
