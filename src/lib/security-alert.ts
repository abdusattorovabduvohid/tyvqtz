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

// Завод живёт по Ташкенту (UTC+5), сервер — по UTC.
const TASHKENT_OFFSET_H = 5;
const NIGHT_FROM = 0;
const NIGHT_TO = 5;

function tashkentHour(d: Date): number {
  return (d.getUTCHours() + TASHKENT_OFFSET_H) % 24;
}

export type AlertKind = "locked" | "foreign" | "night";

/** Что в этом входе подозрительного. null — ничего, сообщать не о чем. */
export function suspicionOf(
  info: Pick<RequestInfo, "ipCountry">,
  opts: { locked?: boolean; at?: Date } = {}
): AlertKind | null {
  if (opts.locked) return "locked";
  // Страну знаем только на Vercel; на своём сервере заголовка нет и
  // проверка просто не срабатывает — это лучше, чем ложные тревоги.
  if (info.ipCountry && info.ipCountry !== "UZ") return "foreign";
  const h = tashkentHour(opts.at ?? new Date());
  if (h >= NIGHT_FROM && h < NIGHT_TO) return "night";
  return null;
}

const TITLES: Record<AlertKind, string> = {
  locked: "🚫 Parol tanlanmoqda",
  foreign: "🌍 Chet eldan kirish",
  night: "🌙 Tunda kirish",
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
