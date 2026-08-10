import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { wagonSchedule } from "@/lib/format";
import { notifyUsers, notifyUsersAndGroup } from "@/lib/notify";
import { notificationsOff } from "@/lib/feature-guard";

// Ежедневные напоминания по плану. Запускается кроном раз в сутки утром
// (см. vercel.json). Смотрит план дат каждого вагона и шлёт:
//   · «завтра начинается позиция №N» — чтобы бригада подготовилась;
//   · «сегодня начинается позиция №N»;
//   · «позиция №N просрочена на K дн.» — если срок прошёл, а приёмки нет;
//   · «ждём вашего согласования создания вагона».
//
// Защита: заголовок Authorization: Bearer <CRON_SECRET> или ?key=<CRON_SECRET>.
// Vercel Cron сам подставляет Bearer CRON_SECRET.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Завод живёт по Ташкенту (UTC+5), а сервер — по UTC. Ключ дня считаем
// в ташкентском времени, иначе утренний крон «видит» вчерашний день.
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

function dayKey(d: Date): string {
  const shifted = new Date(d.getTime() + TASHKENT_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const key = new URL(req.url).searchParams.get("key");
  return key === secret;
}

async function run() {
  const now = new Date();
  const todayKey = dayKey(now);
  const tomorrowKey = dayKey(addDays(now, 1));

  const wagons = await prisma.wagon.findMany({
    where: { creationStatus: { in: ["pending", "approved"] } },
    include: {
      stages: {
        orderBy: { number: "asc" },
        include: {
          assignments: { select: { userId: true } },
        },
      },
      creationApprovals: {
        orderBy: { order: "asc" },
        select: { userId: true, order: true, decision: true },
      },
    },
  });

  let sent = 0;

  for (const wagon of wagons) {
    // ── Ждём согласования создания: пишем тому, чья сейчас очередь ──
    if (wagon.creationStatus === "pending") {
      const next = wagon.creationApprovals.find((a) => a.decision === "pending");
      const earlierOk = wagon.creationApprovals
        .filter((a) => next && a.order < next.order)
        .every((a) => a.decision === "approved");
      if (next && earlierOk) {
        await notifyUsers([next.userId], {
          title: `Vagon №${wagon.number} — kelishuv kutilmoqda`,
          body: "Vagon yaratildi va sizning tasdig‘ingizni kutmoqda.",
          url: `/dashboard/wagons/${wagon.id}`,
          tag: `wagon-approval-${wagon.id}`,
        });
        sent++;
      }
      continue; // пока не согласовано — позиции не идут
    }

    const start = wagon.plannedStart ?? wagon.createdAt;
    const { plan } = wagonSchedule(
      start,
      wagon.stages.map((s) => s.durationSeconds)
    );

    for (let i = 0; i < wagon.stages.length; i++) {
      const s = wagon.stages[i];
      if (s.status === "done") continue;
      const p = plan[i];
      if (!p) continue;

      const people = s.assignments.map((a) => a.userId);
      if (people.length === 0) continue;

      // предыдущая позиция закрыта — значит эта реально на очереди
      const prevDone = i === 0 || wagon.stages[i - 1].status === "done";
      const startKey = dayKey(p.start);
      const endKey = dayKey(p.end);
      const link = `/dashboard/wagons/${wagon.id}`;

      if (startKey === tomorrowKey) {
        await notifyUsers(people, {
          title: `Vagon №${wagon.number} — ertaga ${s.number}-pozitsiya`,
          body: `Ertaga «${s.nameUz}» boshlanadi. Tayyorgarlikni ko‘ring.`,
          url: link,
          tag: `stage-tomorrow-${s.id}`,
        });
        sent++;
      } else if (startKey === todayKey) {
        await notifyUsers(people, {
          title: `Vagon №${wagon.number} — bugun ${s.number}-pozitsiya`,
          body: `Bugun «${s.nameUz}» boshlanadi.`,
          url: link,
          tag: `stage-today-${s.id}`,
        });
        sent++;
      } else if (endKey < todayKey && prevDone) {
        // считаем просрочку в календарных днях — для текста этого хватает
        const lateDays = Math.max(
          1,
          Math.round((Date.parse(todayKey) - Date.parse(endKey)) / 86400000)
        );
        await notifyUsersAndGroup(people, {
          title: `Vagon №${wagon.number} — ${s.number}-pozitsiya kechikdi`,
          body: `«${s.nameUz}» muddati ${lateDays} kun o‘tdi, hali qabul qilinmagan.`,
          url: link,
          tag: `stage-late-${s.id}`,
        });
        sent++;
      }
    }
  }

  return sent;
}

export async function GET(req: Request) {
  const off = notificationsOff();
  if (off) return off;

  if (!authorized(req)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 401 });
  }
  try {
    const sent = await run();
    return NextResponse.json({ ok: true, sent });
  } catch (err) {
    console.error("cron/notify", err);
    return NextResponse.json({ error: "Ошибка крона" }, { status: 500 });
  }
}

// Vercel Cron ходит GET-ом, но с внешним кроном (cron-job.org) удобнее POST.
export const POST = GET;
