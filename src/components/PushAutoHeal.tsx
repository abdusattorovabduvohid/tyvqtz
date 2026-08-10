"use client";

import { useEffect } from "react";
import { apiFetch } from "@/lib/client";
import { pushSupported, syncSubscription } from "@/lib/push-client";
import { NOTIFICATIONS_ENABLED } from "@/lib/features";

// Тихо чинит подписку на уведомления. Ничего не рисует и ничего не спрашивает.
//
// Две беды, которые она лечит:
//   1) на сервере поменяли VAPID-ключ — старые подписки push-сервис больше не
//      принимает, но в браузере они выглядят живыми. Переоформляем.
//   2) запись о подписке пропала из базы (чистка, перенос) — отдаём заново.
//
// Разрешение у браузера уже есть (иначе выходим сразу), поэтому жеста
// пользователя не требуется и никакого окна не выскакивает.

const STAMP_KEY = "tyvqtz-push-sync";
// чаще смысла нет: сотрудник заходит в систему по многу раз за смену
const EVERY_MS = 6 * 60 * 60 * 1000;

export function PushAutoHeal() {
  useEffect(() => {
    if (!NOTIFICATIONS_ENABLED) return; // раздел выключен в features.ts
    if (process.env.NODE_ENV !== "production") return;
    if (!pushSupported()) return;
    if (Notification.permission !== "granted") return;

    const last = Number(localStorage.getItem(STAMP_KEY) || 0);
    if (Date.now() - last < EVERY_MS) return;

    let cancelled = false;

    (async () => {
      try {
        const { publicKey } = await apiFetch<{ publicKey: string | null }>(
          "/api/push/key"
        );
        if (!publicKey || cancelled) return;

        const res = await syncSubscription(publicKey);
        if (cancelled || res.action === "nothing" || !res.subscription) return;

        await apiFetch("/api/push/subscribe", {
          method: "POST",
          body: JSON.stringify(res.subscription.toJSON()),
        });

        // подписка переоформлена — прежнюю запись из базы убираем
        if (res.oldEndpoint) {
          await apiFetch("/api/push/subscribe", {
            method: "DELETE",
            body: JSON.stringify({ endpoint: res.oldEndpoint }),
          }).catch(() => {});
        }

        localStorage.setItem(STAMP_KEY, String(Date.now()));
      } catch {
        // молча: уведомления — прогрессивное улучшение, работу не ломаем
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
