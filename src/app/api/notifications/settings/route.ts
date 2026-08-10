import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, handleError } from "@/lib/api";
import { pushEnabled, telegramEnabled } from "@/lib/notify";

// Состояние уведомлений текущего сотрудника — для страницы настроек.
// Публичный VAPID-ключ отдаём отсюда, а не через NEXT_PUBLIC_*: ключ можно
// поменять в проде без пересборки фронта.
export async function GET() {
  try {
    const user = await requireUser();

    const [devices, me] = await Promise.all([
      prisma.pushSubscription.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, endpoint: true, userAgent: true, createdAt: true },
      }),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { telegramChatId: true, telegramUsername: true },
      }),
    ]);

    return NextResponse.json({
      push: {
        enabled: pushEnabled(),
        publicKey: pushEnabled() ? process.env.VAPID_PUBLIC_KEY : null,
        devices: devices.map((d) => ({
          id: d.id,
          endpoint: d.endpoint,
          userAgent: d.userAgent,
          createdAt: d.createdAt,
        })),
      },
      telegram: {
        enabled: telegramEnabled(),
        botUsername: process.env.TELEGRAM_BOT_USERNAME || null,
        linked: Boolean(me?.telegramChatId),
        username: me?.telegramUsername ?? null,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
