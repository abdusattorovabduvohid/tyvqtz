import { NextResponse } from "next/server";
import { flushOutbox } from "@/lib/notify";
import { notificationsOff } from "@/lib/feature-guard";
import { authorizedCron } from "@/lib/cron";

// Добивает недоставленные уведомления из очереди NotificationOutbox.
//
// Отдельно от /api/cron/notify намеренно: тот раз в сутки пересчитывает
// планы всех вагонов и рассылает напоминания — гонять его каждые пять минут
// значит завалить сотрудников одинаковыми сообщениями. Здесь же работы на
// доли секунды, и звать этот адрес можно часто.
//
// На Vercel Hobby крон ходит раз в сутки, поэтому сюда стучится внешний
// бесплатный планировщик (cron-job.org):
//   POST https://<сайт>/api/cron/retry?key=<CRON_SECRET>   каждые 5–10 минут
//
// Пустая очередь — обычное дело: тогда запрос почти ничего не стоит.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const off = notificationsOff();
  if (off) return off;

  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 401 });
  }

  const result = await flushOutbox();
  return NextResponse.json({ ok: true, ...result });
}

export const POST = GET;
