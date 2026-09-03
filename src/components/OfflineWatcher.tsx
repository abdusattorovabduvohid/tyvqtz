"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Сама перепроверяет, не включили ли систему обратно.
//
// Без этого сотрудник сидел бы на заглушке до тех пор, пока не догадается
// обновить страницу — а он не догадается и позвонит суперадмину.
// Страница серверная и force-dynamic, поэтому router.refresh() перезапускает
// проверку, и как только сайт включат, редирект уводит в дашборд сам.
const EVERY_MS = 20_000;

export function OfflineWatcher() {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), EVERY_MS);
    // Вернулись во вкладку — проверяем сразу, не дожидаясь таймера.
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
