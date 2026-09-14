// Сообщения суперадминам о подозрительных входах.
//
// Намеренно НЕ смотрит на NOTIFICATIONS_ENABLED: тот флаг выключает раздел
// уведомлений для сотрудников (рассылки о вагонах, этапах), а это —
// безопасность. Выключенный раздел уведомлений не должен означать, что
// суперадмин перестал узнавать о подборе пароля.
//
// Нужен только TELEGRAM_BOT_TOKEN. Нет токена — функция молча ничего не
// делает, вход при этом работает как обычно.

import { prisma } from "./db";
import { telegramSend } from "./notify";
import type { RequestInfo } from "./request-info";

// Завод живёт по Ташкенту (UTC+5, без перехода на летнее время), сервер —
// по UTC.
const TASHKENT_OFFSET_MIN = 5 * 60;

// Рабочее время: будни с 08:00 до 17:10. Суббота и воскресенье — выходные
// целиком. Вход вне этих рамок сам по себе не преступление, но суперадмин
// хочет знать, кто сидит в системе после смены.
const WORK_FROM_MIN = 8 * 60;
const WORK_TO_MIN = 17 * 60 + 10;

export function isWorkTime(d: Date): boolean {
  const t = new Date(d.getTime() + TASHKENT_OFFSET_MIN * 60_000);
  const day = t.getUTCDay(); // 0 — воскресенье, 6 — суббота
  if (day === 0 || day === 6) return false;
  const min = t.getUTCHours() * 60 + t.getUTCMinutes();
  return min >= WORK_FROM_MIN && min < WORK_TO_MIN;
}

/** Начало текущих ташкентских суток, выраженное в UTC. */
export function tashkentDayStart(d: Date): Date {
  const t = new Date(d.getTime() + TASHKENT_OFFSET_MIN * 60_000);
  t.setUTCHours(0, 0, 0, 0);
  return new Date(t.getTime() - TASHKENT_OFFSET_MIN * 60_000);
}

export type AlertKind =
  | "locked"
  | "foreign"
  | "offhours"
  | "activity"
  | "device";

/** Что в этом входе подозрительного. null — ничего, сообщать не о чем. */
export function suspicionOf(
  info: Pick<RequestInfo, "ipCountry">,
  opts: { locked?: boolean; at?: Date } = {}
): AlertKind | null {
  if (opts.locked) return "locked";
  // Страну знаем только на Vercel; на своём сервере заголовка нет и
  // проверка просто не срабатывает — это лучше, чем ложные тревоги.
  if (info.ipCountry && info.ipCountry !== "UZ") return "foreign";
  if (!isWorkTime(opts.at ?? new Date())) return "offhours";
  return null;
}

const TITLES: Record<AlertKind, string> = {
  locked: "🚫 Parol tanlanmoqda",
  foreign: "🌍 Chet eldan kirish",
  offhours: "🕐 Ish vaqtidan tashqari kirish",
  activity: "🕐 Ish vaqtidan tashqari ishlamoqda",
  device: "📱 Boshqa qurilmadan kirish",
};

export async function alertSuperAdmins(
  kind: AlertKind,
  lines: string[]
): Promise<void> {
  try {
    const admins = await prisma.user.findMany({
      where: { isActive: true, telegramChatId: { not: null }, role: { isSuperAdmin: true } },
      select: { telegramChatId: true },
    });
    if (admins.length === 0) return;

    const text = [`<b>${TITLES[kind]}</b>`, "", ...lines].join("\n");
    await Promise.allSettled(
      admins.map((a) =>
        telegramSend(a.telegramChatId as string, text, {
          url: "/dashboard/control",
          buttonText: "Nazorat paneli",
        })
      )
    );
  } catch (err) {
    // Тревога не должна ронять вход — залогировали и забыли.
    console.error("security alert failed", err);
  }
}
