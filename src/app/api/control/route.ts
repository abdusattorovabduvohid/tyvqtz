import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleError, requireSuperAdmin } from "@/lib/api";
import { presenceOf, ONLINE_MIN, IDLE_MIN } from "@/lib/presence";
import { getSetting, isSiteEnabled, LAST_BACKUP_AT } from "@/lib/settings";
import { NOTIFICATIONS_ENABLED } from "@/lib/features";
import { telegramWebhookHealth } from "@/lib/notify";

// Всё, что показывает панель контроля, одним запросом: состояние сайта,
// счётчики, кто в сети и последние входы. Отдельные эндпоинты на каждую
// плитку заставили бы телефон делать четыре round-trip по заводскому
// интернету вместо одного.
export async function GET() {
  try {
    await requireSuperAdmin();

    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * 60_000);
    const idleFrom = new Date(now - IDLE_MIN * 60_000);

    const [siteEnabled, lastBackup, users, logs, todayOk, todayFail] =
      await Promise.all([
        isSiteEnabled(),
        getSetting(LAST_BACKUP_AT),
        prisma.user.findMany({
          where: { isActive: true },
          orderBy: [{ lastSeenAt: { sort: "desc", nulls: "last" } }, { lastName: "asc" }],
          select: {
            id: true,
            firstName: true,
            lastName: true,
            seh: true,
            lastSeenAt: true,
            role: { select: { nameUz: true, nameRu: true, isSuperAdmin: true } },
          },
        }),
        prisma.loginLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            loginTried: true,
            success: true,
            reason: true,
            ip: true,
            device: true,
            os: true,
            browser: true,
            ipCity: true,
            ipCountry: true,
            gpsLat: true,
            gpsLng: true,
            gpsAccuracy: true,
            createdAt: true,
            user: { select: { firstName: true, lastName: true } },
          },
        }),
        prisma.loginLog.count({ where: { success: true, createdAt: { gte: dayAgo } } }),
        prisma.loginLog.count({ where: { success: false, createdAt: { gte: dayAgo } } }),
      ]);

    // Здоровье уведомлений: сколько застряло в очереди, по скольким сдались
    // и кто из сотрудников не подключил телеграм — такой человек ни одного
    // уведомления не получит, и знать об этом надо заранее, а не по факту
    // сорванного срока.
    const [queued, gaveUp, noTelegram, webhook] = NOTIFICATIONS_ENABLED
      ? await Promise.all([
          prisma.notificationOutbox.count({
            where: { sentAt: null, nextTryAt: { not: null } },
          }),
          prisma.notificationOutbox.count({
            where: { sentAt: null, nextTryAt: null },
          }),
          prisma.user.findMany({
            where: { isActive: true, telegramChatId: null },
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
            select: { id: true, firstName: true, lastName: true, seh: true },
          }),
          telegramWebhookHealth(),
        ])
      : [
          0,
          0,
          [] as { id: string; firstName: string; lastName: string; seh: string | null }[],
          null,
        ];

    const people = users.map((u) => ({
      id: u.id,
      name: `${u.lastName} ${u.firstName}`,
      seh: u.seh,
      role: u.role.nameUz,
      isSuperAdmin: u.role.isSuperAdmin,
      lastSeenAt: u.lastSeenAt,
      state: presenceOf(u.lastSeenAt),
    }));

    return NextResponse.json({
      siteEnabled,
      lastBackupAt: lastBackup,
      onlineMin: ONLINE_MIN,
      counts: {
        online: people.filter((p) => p.state === "online").length,
        todayOk,
        todayFail,
      },
      // В список «кто в сети» попадают только реально активные: полсотни
      // строк «был вчера» на телефоне листать невозможно.
      people: people.filter((p) => p.lastSeenAt && p.lastSeenAt >= idleFrom),
      offlineCount: people.filter((p) => !p.lastSeenAt || p.lastSeenAt < idleFrom).length,
      notify: {
        enabled: NOTIFICATIONS_ENABLED,
        queued,
        gaveUp,
        noTelegram: noTelegram.map((u) => ({
          id: u.id,
          name: `${u.lastName} ${u.firstName}`,
          seh: u.seh,
        })),
        webhook,
      },
      logs: logs.map((l) => ({
        ...l,
        name: l.user ? `${l.user.lastName} ${l.user.firstName}` : null,
        user: undefined,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
