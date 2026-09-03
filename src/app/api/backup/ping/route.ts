import { NextResponse } from "next/server";
import { setSetting, LAST_BACKUP_AT } from "@/lib/settings";

// Отметка «резервная копия снята».
//
// Дёргает GitHub Actions последним шагом воркфлоу, после удачного дампа.
// Спрашивать GitHub API самим было бы честнее, но для этого нужен токен с
// доступом к репозиторию — здесь хватает одного общего секрета.
//
// Защита та же, что у крона: Authorization: Bearer <CRON_SECRET>.

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Без секрета в окружении эндпоинт закрыт: открытый доступ позволил бы
  // кому угодно рисовать «бэкап свежий», когда его на самом деле нет.
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  try {
    await setSetting(LAST_BACKUP_AT, new Date().toISOString(), "github-actions");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("backup ping failed", err);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
