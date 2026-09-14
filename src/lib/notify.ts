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
import { envSiteUrl } from "./site";

export interface NotifyPayload {
  title: string;
  body: string;
  // путь внутри сайта, например /dashboard/wagons/abc — открывается по клику
  url?: string;
  // одинаковый tag заменяет предыдущее уведомление вместо новой строки в шторке
  tag?: string;
}

// ── Разбор ошибок web-push ────────────────────────────────────────────────
// В catch приходит unknown, а не готовый объект библиотеки: это может быть и
// обрыв сети, и таймаут. Поля читаем с проверкой, иначе чужая ошибка
// притворилась бы ответом push-сервиса и мы отписали бы живое устройство.

/** HTTP-код ответа push-сервиса, если он вообще успел ответить. */
function pushStatusCode(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null || !("statusCode" in err)) return undefined;
  return Number((err as { statusCode: unknown }).statusCode) || undefined;
}

/** Подробность для лога: у web-push это body ответа, у обычной ошибки — message. */
function pushErrorDetail(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const e = err as { body?: unknown; message?: unknown };
    if (typeof e.body === "string" && e.body) return e.body;
    if (typeof e.message === "string" && e.message) return e.message;
  }
  return String(err);
}

// Адрес сайта для ссылок в телеграме и в клике по пушу.
// Здесь нужен именно «сырой» адрес: если он не настроен, fullLink ниже
// сознательно не подставляет ссылку, вместо того чтобы вести на запасной домен.
export function appUrl(): string {
  return envSiteUrl();
}

function fullLink(url?: string): string | null {
  if (!url) return null;
  const base = appUrl();
  return base ? `${base}${url}` : null;
}

// ─────────────────────── Очередь недоставленного ───────────────────────
//
// Отправляем сразу, в том же запросе — так уведомление приходит через
// секунду, а не через час. Но заводской интернет рвётся, а телеграм иногда
// не отвечает за 7 секунд: раньше такое уведомление просто пропадало.
// Теперь неудачная отправка ложится в NotificationOutbox, а /api/cron/retry
// добивает её с нарастающей паузой.

// После стольких попыток сдаёмся: строка остаётся в таблице с lastError,
// её видно в панели контроля.
const MAX_ATTEMPTS = 8;

// Паузы между попытками. Первая — почти сразу (сеть моргнула), дальше реже,
// чтобы упавший на полдня телеграм не жёг лимиты Vercel.
const BACKOFF_MIN = [1, 5, 15, 60, 180, 360, 720, 1440];

function nextTry(attempts: number): Date {
  const min = BACKOFF_MIN[Math.min(attempts, BACKOFF_MIN.length - 1)];
  return new Date(Date.now() + min * 60_000);
}

type Channel = "telegram" | "push" | "group";

// Кладём недоставленное в очередь. Само по себе никогда не бросает:
// если и запись в очередь не удалась — уведомление всё равно не должно
// уронить создание вагона.
async function enqueue(
  channel: Channel,
  target: string | null,
  userId: string | null,
  payload: NotifyPayload,
  error: string
) {
  try {
    await prisma.notificationOutbox.create({
      data: {
        channel,
        target,
        userId,
        title: payload.title,
        body: payload.body,
        url: payload.url ?? null,
        tag: payload.tag ?? null,
        attempts: 1,
        lastError: error.slice(0, 500),
        nextTryAt: nextTry(1),
      },
    });
  } catch (err) {
    console.error("outbox enqueue", err);
  }
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

function pushBody(payload: NotifyPayload): string {
  return JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/dashboard",
    tag: payload.tag,
  });
}

// «dead» — подписки больше нет, повторять бессмысленно;
// «retry» — не доставили, но шанс есть: кладём в очередь.
type PushOutcome = "ok" | "dead" | "retry";

async function pushOne(
  sub: { endpoint: string; p256dh: string; auth: string },
  body: string
): Promise<{ outcome: PushOutcome; code?: number; detail: string }> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      body,
      { TTL: 60 * 60 * 12 }
    );
    return { outcome: "ok", detail: "" };
  } catch (err) {
    const code = pushStatusCode(err);
    const detail = pushErrorDetail(err);
    // подписка мертва: браузер удалён, кеш очищен, PWA снесена
    if (code === 404 || code === 410) return { outcome: "dead", code, detail };
    return { outcome: "retry", code, detail };
  }
}

async function sendWebPush(userIds: string[], payload: NotifyPayload) {
  if (!pushEnabled() || userIds.length === 0) return;

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });
  if (subs.length === 0) return;

  const body = pushBody(payload);

  const dead: string[] = [];
  const failed: string[] = [];
  const alive: string[] = [];

  await Promise.allSettled(
    subs.map(async (s) => {
      const r = await pushOne(s, body);
      if (r.outcome === "ok") {
        alive.push(s.id);
        return;
      }
      if (r.outcome === "dead") {
        dead.push(s.id);
        return;
      }
      if (r.code === 401 || r.code === 403) {
        // push-сервис не принял нашу подпись: чаще всего сменился (или не
        // подхватился) VAPID-ключ. Сразу не рубим — считаем отказы.
        failed.push(s.id);
        console.error("push rejected (VAPID?)", r.code, r.detail);
      } else {
        console.error("push error", r.code, r.detail);
      }
      // адресуем повтор по endpoint: если человек за это время переподписался,
      // строка отвалится сама, а живому устройству дубль не прилетит
      await enqueue("push", s.endpoint, s.userId, payload, r.detail);
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

// ── Здоровье вебхука ──────────────────────────────────────────────────────
//
// Вебхук нужен только для входящих команд — то есть для /start, которым
// сотрудник привязывает свой чат. Ломается он молча: телеграм копит апдейты,
// а люди просто не могут подключиться. Ровно так и было, пока APP_URL вёл на
// домен с редиректом: телеграм за редиректом не идёт и получал 308.
//
// Поэтому состояние вебхука видно в панели контроля — чтобы не вспоминать
// про скрипт setup-telegram.mjs раз в полгода.

export interface WebhookHealth {
  ok: boolean;
  url: string | null;
  // куда вебхук должен указывать по нынешнему APP_URL
  expected: string;
  // сколько сообщений телеграм не смог нам отдать
  pending: number;
  lastError: string | null;
  lastErrorAt: string | null;
}

// Панель сама обновляется раз в 30 секунд — дёргать телеграм так часто
// незачем, состояние вебхука меняется раз в год.
const WEBHOOK_TTL_MS = 5 * 60_000;
// Старая ошибка после починки висит в getWebhookInfo ещё какое-то время:
// тревожимся только из-за свежей.
const WEBHOOK_ERROR_FRESH_MS = 24 * 60 * 60_000;

let webhookCache: { at: number; data: WebhookHealth } | null = null;

export async function telegramWebhookHealth(): Promise<WebhookHealth | null> {
  if (!telegramEnabled()) return null;
  if (webhookCache && Date.now() - webhookCache.at < WEBHOOK_TTL_MS) {
    return webhookCache.data;
  }

  const base = appUrl();
  const expected = base ? `${base}/api/telegram/webhook` : "";
  let data: WebhookHealth = {
    ok: false,
    url: null,
    expected,
    pending: 0,
    lastError: "getWebhookInfo failed",
    lastErrorAt: null,
  };

  try {
    const r = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`,
      { signal: AbortSignal.timeout(5000) }
    );
    const j = (await r.json()) as {
      ok?: boolean;
      result?: {
        url?: string;
        pending_update_count?: number;
        last_error_message?: string;
        last_error_date?: number;
      };
    };
    const info = j?.result;
    if (j?.ok && info) {
      const url = info.url || null;
      const errAt = info.last_error_date
        ? new Date(info.last_error_date * 1000)
        : null;
      const freshError =
        Boolean(info.last_error_message) &&
        Boolean(errAt) &&
        Date.now() - (errAt as Date).getTime() < WEBHOOK_ERROR_FRESH_MS;
      data = {
        url,
        expected,
        pending: Number(info.pending_update_count) || 0,
        lastError: info.last_error_message || null,
        lastErrorAt: errAt ? errAt.toISOString() : null,
        // адрес задан, ведёт на наш сайт и свежих отказов нет
        ok: Boolean(url) && (!expected || url === expected) && !freshError,
      };
    }
  } catch (err) {
    console.error("getWebhookInfo", err);
  }

  webhookCache = { at: Date.now(), data };
  return data;
}

function telegramText(payload: NotifyPayload): string {
  return `<b>${esc(payload.title)}</b>\n${esc(payload.body)}`;
}

async function sendTelegram(userIds: string[], payload: NotifyPayload) {
  if (!telegramEnabled() || userIds.length === 0) return;

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, telegramChatId: { not: null } },
    select: { id: true, telegramChatId: true },
  });

  await Promise.allSettled(
    users.map(async (u) => {
      const chat = u.telegramChatId as string;
      const ok = await telegramSend(chat, telegramText(payload), {
        url: payload.url,
      });
      if (!ok) await enqueue("telegram", chat, u.id, payload, "send failed");
    })
  );
}

// Общий чат/группа завода — дублируем туда всё, если задан TELEGRAM_GROUP_CHAT_ID.
async function sendTelegramGroup(payload: NotifyPayload) {
  const chat = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (!chat || !telegramEnabled()) return;
  const ok = await telegramSend(chat, telegramText(payload), {
    url: payload.url,
  });
  if (!ok) await enqueue("group", chat, null, payload, "send failed");
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

// ─────────────────────── Разбор очереди повторов ───────────────────────

export interface FlushResult {
  sent: number; // доставили с повтора
  failed: number; // снова не вышло, попробуем позже
  gaveUp: number; // исчерпали попытки
  dropped: number; // повторять некуда: устройство отписалось
}

// За один прогон берём столько строк. Больше не нужно: на Vercel Hobby у
// функции 60 секунд, а телеграм отвечает за доли секунды.
const FLUSH_BATCH = 50;

// «Аренда» строки: сразу отодвигаем nextTryAt, чтобы два прогона крона,
// наложившись друг на друга, не отправили одно уведомление дважды.
const LEASE_MIN = 5;

// Сколько держим разобранные строки. Доставленные нужны недолго — только
// чтобы понять «дошло или нет», а несдавшиеся оставляем на месяц: по ним
// видно, что именно ломается.
const KEEP_SENT_DAYS = 3;
const KEEP_GAVEUP_DAYS = 30;

async function purgeOutbox() {
  const now = Date.now();
  await prisma.notificationOutbox
    .deleteMany({
      where: { sentAt: { lt: new Date(now - KEEP_SENT_DAYS * 86400_000) } },
    })
    .catch(() => {});
  await prisma.notificationOutbox
    .deleteMany({
      where: {
        sentAt: null,
        nextTryAt: null,
        createdAt: { lt: new Date(now - KEEP_GAVEUP_DAYS * 86400_000) },
      },
    })
    .catch(() => {});
}

type OutboxRow = {
  id: string;
  channel: string;
  target: string | null;
  title: string;
  body: string;
  url: string | null;
  tag: string | null;
  attempts: number;
};

type AttemptResult =
  | { kind: "ok" }
  | { kind: "retry"; detail: string }
  | { kind: "drop" } // адресата больше нет
  | { kind: "skip" }; // канал выключен — попытку не тратим

async function attemptRow(row: OutboxRow): Promise<AttemptResult> {
  const payload: NotifyPayload = {
    title: row.title,
    body: row.body,
    url: row.url ?? undefined,
    tag: row.tag ?? undefined,
  };

  if (row.channel === "telegram" || row.channel === "group") {
    if (!row.target) return { kind: "drop" };
    if (!telegramEnabled()) return { kind: "skip" };
    const ok = await telegramSend(row.target, telegramText(payload), {
      url: payload.url,
    });
    return ok ? { kind: "ok" } : { kind: "retry", detail: "send failed" };
  }

  if (row.channel === "push") {
    if (!row.target) return { kind: "drop" };
    if (!pushEnabled()) return { kind: "skip" };
    const sub = await prisma.pushSubscription.findUnique({
      where: { endpoint: row.target },
    });
    // устройство переподписалось или отписалось — слать уже некуда
    if (!sub) return { kind: "drop" };
    const r = await pushOne(sub, pushBody(payload));
    if (r.outcome === "ok") return { kind: "ok" };
    if (r.outcome === "dead") {
      await prisma.pushSubscription
        .delete({ where: { id: sub.id } })
        .catch(() => {});
      return { kind: "drop" };
    }
    return { kind: "retry", detail: r.detail };
  }

  return { kind: "drop" }; // неизвестный канал — мусор из старой версии
}

// Добивает недоставленное. Вызывается кроном; сам никогда не бросает.
export async function flushOutbox(limit = FLUSH_BATCH): Promise<FlushResult> {
  const res: FlushResult = { sent: 0, failed: 0, gaveUp: 0, dropped: 0 };
  if (!NOTIFICATIONS_ENABLED) return res;

  try {
    const rows = await prisma.notificationOutbox.findMany({
      where: { sentAt: null, nextTryAt: { lte: new Date() } },
      orderBy: { nextTryAt: "asc" },
      take: limit,
      select: {
        id: true,
        channel: true,
        target: true,
        title: true,
        body: true,
        url: true,
        tag: true,
        attempts: true,
      },
    });

    if (rows.length > 0) {
      await prisma.notificationOutbox.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { nextTryAt: new Date(Date.now() + LEASE_MIN * 60_000) },
      });
    }

    for (const row of rows) {
      const r = await attemptRow(row);

      if (r.kind === "skip") continue; // аренда сама отпустит строку

      if (r.kind === "drop") {
        await prisma.notificationOutbox
          .delete({ where: { id: row.id } })
          .catch(() => {});
        res.dropped++;
        continue;
      }

      if (r.kind === "ok") {
        await prisma.notificationOutbox
          .update({
            where: { id: row.id },
            data: {
              sentAt: new Date(),
              nextTryAt: null,
              attempts: { increment: 1 },
              lastError: null,
            },
          })
          .catch(() => {});
        res.sent++;
        continue;
      }

      const attempts = row.attempts + 1;
      const done = attempts >= MAX_ATTEMPTS;
      await prisma.notificationOutbox
        .update({
          where: { id: row.id },
          data: {
            attempts,
            lastError: r.detail.slice(0, 500),
            nextTryAt: done ? null : nextTry(attempts),
          },
        })
        .catch(() => {});
      if (done) res.gaveUp++;
      else res.failed++;
    }

    await purgeOutbox();
  } catch (err) {
    console.error("flushOutbox", err);
  }

  return res;
}
