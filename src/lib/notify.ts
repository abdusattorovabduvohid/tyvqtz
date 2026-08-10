// Отправка уведомлений сотрудникам: Web Push (браузер/PWA) + Telegram.
//
// ПРАВИЛО: уведомления — это дополнение, а не часть бизнес-операции.
// Ни одна ошибка отправки не должна ронять запрос (создание вагона, приёмку
// дня и т.д.), поэтому всё обёрнуто и наружу ошибки не выпускаются.
//
// Тексты — на узбекском: DEFAULT_LANG системы «uz», язык у человека
// хранится только в браузере, серверу он неизвестен.

import webpush from "web-push";
import { prisma } from "./db";
import { NOTIFICATIONS_ENABLED } from "./features";

export interface NotifyPayload {
  title: string;
  body: string;
  // путь внутри сайта, например /dashboard/wagons/abc — открывается по клику
  url?: string;
  // одинаковый tag заменяет предыдущее уведомление вместо новой строки в шторке
  tag?: string;
}

// Адрес сайта для ссылок в телеграме и в клике по пушу.
export function appUrl(): string {
  const raw =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return raw.replace(/\/+$/, "");
}

function fullLink(url?: string): string | null {
  if (!url) return null;
  const base = appUrl();
  return base ? `${base}${url}` : null;
}

// ─────────────────────────── Web Push ───────────────────────────

// Сколько отказов подряд терпим, прежде чем выбросить подписку.
const PUSH_FAIL_LIMIT = 5;

let vapidConfigured: boolean | null = null;

function initVapid(): boolean {
  if (vapidConfigured !== null) return vapidConfigured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    vapidConfigured = false;
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || appUrl() || "mailto:admin@example.com",
    pub,
    priv
  );
  vapidConfigured = true;
  return true;
}

export function pushEnabled(): boolean {
  if (!NOTIFICATIONS_ENABLED) return false;
  return initVapid();
}

async function sendWebPush(userIds: string[], payload: NotifyPayload) {
  if (!pushEnabled() || userIds.length === 0) return;

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });
  if (subs.length === 0) return;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/dashboard",
    tag: payload.tag,
  });

  const dead: string[] = [];
  const failed: string[] = [];
  const alive: string[] = [];

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body,
          { TTL: 60 * 60 * 12 }
        );
        alive.push(s.id);
      } catch (err: any) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) {
          // подписка мертва: браузер удалён, кеш очищен, PWA снесена
          dead.push(s.id);
        } else if (code === 401 || code === 403) {
          // push-сервис не принял нашу подпись: чаще всего сменился (или не
          // подхватился) VAPID-ключ. Сразу не рубим — считаем отказы.
          failed.push(s.id);
          console.error("push rejected (VAPID?)", code, err?.body ?? err?.message);
        } else {
          console.error("push error", code, err?.body ?? err?.message);
        }
      }
    })
  );

  if (dead.length) {
    await prisma.pushSubscription
      .deleteMany({ where: { id: { in: dead } } })
      .catch(() => {});
  }
  if (failed.length) {
    await prisma.pushSubscription
      .updateMany({
        where: { id: { in: failed } },
        data: { failCount: { increment: 1 } },
      })
      .catch(() => {});
    // терпим временный сбой конфигурации, но не бесконечно
    await prisma.pushSubscription
      .deleteMany({ where: { id: { in: failed }, failCount: { gte: PUSH_FAIL_LIMIT } } })
      .catch(() => {});
  }
  if (alive.length) {
    await prisma.pushSubscription
      .updateMany({
        where: { id: { in: alive } },
        data: { lastOkAt: new Date(), failCount: 0 },
      })
      .catch(() => {});
  }
}

// ─────────────────────────── Telegram ───────────────────────────

export function telegramEnabled(): boolean {
  if (!NOTIFICATIONS_ENABLED) return false;
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

// Экранирование под parse_mode=HTML: телеграм ругается на голые < & >.
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function telegramSend(
  chatId: string,
  text: string,
  opts: { url?: string; buttonText?: string } = {}
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  const link = fullLink(opts.url);
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (link) {
    body.reply_markup = {
      inline_keyboard: [[{ text: opts.buttonText || "Ochish", url: link }]],
    };
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // связь на заводе слабая: не держим запрос дольше 7 секунд
      signal: AbortSignal.timeout(7000),
    });
    if (!r.ok) {
      console.error("telegram send failed", r.status, await r.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("telegram send error", err);
    return false;
  }
}

function telegramText(payload: NotifyPayload): string {
  return `<b>${esc(payload.title)}</b>\n${esc(payload.body)}`;
}

async function sendTelegram(userIds: string[], payload: NotifyPayload) {
  if (!telegramEnabled() || userIds.length === 0) return;

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, telegramChatId: { not: null } },
    select: { telegramChatId: true },
  });

  await Promise.allSettled(
    users.map((u) =>
      telegramSend(u.telegramChatId as string, telegramText(payload), {
        url: payload.url,
      })
    )
  );
}

// Общий чат/группа завода — дублируем туда всё, если задан TELEGRAM_GROUP_CHAT_ID.
async function sendTelegramGroup(payload: NotifyPayload) {
  const chat = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (!chat || !telegramEnabled()) return;
  await telegramSend(chat, telegramText(payload), { url: payload.url });
}

// ─────────────────────────── Точки входа ───────────────────────────

// Уведомить конкретных людей. Дубли id убираем, пустой список — выходим.
// Никогда не бросает: уведомление не должно ломать основную операцию.
export async function notifyUsers(
  userIds: (string | null | undefined)[],
  payload: NotifyPayload
): Promise<void> {
  if (!NOTIFICATIONS_ENABLED) return; // раздел выключен в features.ts
  try {
    const ids = Array.from(
      new Set(userIds.filter((x): x is string => Boolean(x)))
    );
    if (ids.length === 0) return;
    await Promise.allSettled([
      sendWebPush(ids, payload),
      sendTelegram(ids, payload),
    ]);
  } catch (err) {
    console.error("notifyUsers", err);
  }
}

// Уведомить всех + общий чат: события уровня завода (создан вагон и т.п.).
export async function notifyUsersAndGroup(
  userIds: (string | null | undefined)[],
  payload: NotifyPayload
): Promise<void> {
  await Promise.allSettled([
    notifyUsers(userIds, payload),
    sendTelegramGroup(payload).catch(() => {}),
  ]);
}

// Имя человека для текста уведомления.
export function personName(u: {
  firstName: string;
  lastName: string;
}): string {
  return `${u.lastName} ${u.firstName}`.trim();
}

// «Вагон №61-107» — как его называют в цехах.
export function wagonLabel(w: { number: string }): string {
  return `№${w.number}`;
}
