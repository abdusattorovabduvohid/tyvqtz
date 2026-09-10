"use client";

import { useEffect, useRef } from "react";

// Опрос сервера, пока страница открыта.
//
// Раньше страницы «Мои позиции» и карточка вагона дёргали сервер каждые пять
// секунд. Для одного человека это незаметно, а на полсотни телефонов, которые
// висят открытыми всю смену, — шестьсот запросов в минуту: столько не выдержит
// ни бесплатный пул Supabase, ни лимиты Vercel.
//
// Двадцать секунд хватает: свои действия обновляют экран сразу (после PATCH
// страницы перечитывают данные сами), а чужие — приёмку дня соседом, запуск
// позиции — увидеть через двадцать секунд ничем не хуже, чем через пять.
//
// Плюс перечитываем сразу при возврате во вкладку: человек разблокировал
// телефон и видит свежее, не дожидаясь таймера. В фоне не опрашиваем вовсе —
// в установленной PWA это лишняя нагрузка, из-за которой iOS быстрее убивает
// процесс.
export const POLL_MS = 20_000;

export function useVisiblePoll(fn: () => void, ms: number = POLL_MS) {
  // держим свежую функцию в ref: иначе таймер пересоздавался бы на каждый
  // рендер страницы
  const saved = useRef(fn);
  useEffect(() => {
    saved.current = fn;
  }, [fn]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) saved.current();
    }, ms);
    const onVisible = () => {
      if (document.visibilityState === "visible") saved.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ms]);
}
