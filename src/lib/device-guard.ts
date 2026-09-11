// Привязка учётки к устройству.
//
// Логин с паролем можно продиктовать кому угодно, а куку, которую мы кладём
// браузеру при первом входе, так не передашь. Поэтому «тот же логин с
// другого телефона» видно сразу: куки в нём нет. Подробности и известные
// слабые места — у модели UserDevice в schema.prisma.

import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";
import type { RequestInfo } from "./request-info";

const COOKIE_NAME = "device";
// Дольше браузеры куку всё равно не держат: Chrome режет срок до 400 дней.
const MAX_AGE_S = 400 * 24 * 60 * 60;

/** id устройства из куки; нет куки — выдаём новый. */
export function deviceIdFromCookie(): string {
  return cookies().get(COOKIE_NAME)?.value || randomUUID();
}

// Кладём куку при каждой попытке входа, в том числе отклонённой: иначе
// каждая попытка с одного и того же чужого телефона заводила бы в панели
// новую строку и новое сообщение в телеграм.
export function setDeviceCookie(deviceId: string) {
  cookies().set(COOKIE_NAME, deviceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export type DeviceVerdict =
  | { allowed: true }
  // firstAttempt — с этого устройства пробуют впервые: только тогда и пишем
  // суперадмину, повторные попытки лишь наращивают счётчик
  | { allowed: false; firstAttempt: boolean };

export async function checkDevice(
  userId: string,
  deviceId: string,
  info: RequestInfo,
  // суперадмина не ограничиваем: заперев себя, он не смог бы открыть
  // и никого другого
  opts: { alwaysAllow?: boolean } = {}
): Promise<DeviceVerdict> {
  const seen = {
    device: info.device,
    os: info.os,
    browser: info.browser,
    ip: info.ip,
    ipCity: info.ipCity,
    lastSeenAt: new Date(),
  };

  const known = await prisma.userDevice.findUnique({
    where: { userId_deviceId: { userId, deviceId } },
    select: { id: true, approved: true },
  });

  if (known) {
    const approved = known.approved || Boolean(opts.alwaysAllow);
    await prisma.userDevice.update({
      where: { id: known.id },
      data: {
        ...seen,
        ...(approved
          ? { approved: true }
          : { attempts: { increment: 1 } }),
      },
    });
    return approved ? { allowed: true } : { allowed: false, firstAttempt: false };
  }

  // Первое устройство человека доверяем молча: иначе в день выкатки ни один
  // из полусотни сотрудников не вошёл бы, пока суперадмин не одобрит каждого.
  const hasAny = await prisma.userDevice.count({ where: { userId } });
  const approved = hasAny === 0 || Boolean(opts.alwaysAllow);

  await prisma.userDevice.create({
    data: {
      userId,
      deviceId,
      ...seen,
      approved,
      approvedAt: approved ? new Date() : null,
    },
  });

  return approved ? { allowed: true } : { allowed: false, firstAttempt: true };
}
