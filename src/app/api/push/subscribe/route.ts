import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, handleError } from "@/lib/api";
import { notificationsOff } from "@/lib/feature-guard";

// Подписка браузера на пуши. Одно устройство = одна запись (ключ — endpoint).
// Если то же устройство раньше было у другого сотрудника (общий планшет
// в цехе), запись переезжает на текущего — иначе пуши уйдут не тому.

const subSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(req: Request) {
  const off = notificationsOff();
  if (off) return off;

  try {
    const user = await requireUser();
    const data = subSchema.parse(await req.json());
    const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

    await prisma.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      create: {
        userId: user.id,
        endpoint: data.endpoint,
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        userAgent,
      },
      update: {
        userId: user.id,
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        userAgent,
        lastOkAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Неверные данные подписки" }, { status: 400 });
    }
    return handleError(err);
  }
}

// Отписка: человек выключил уведомления на этом устройстве.
export async function DELETE(req: Request) {
  const off = notificationsOff();
  if (off) return off;

  try {
    const user = await requireUser();
    const { endpoint } = z
      .object({ endpoint: z.string().url() })
      .parse(await req.json());

    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: user.id },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Неверные данные" }, { status: 400 });
    }
    return handleError(err);
  }
}
