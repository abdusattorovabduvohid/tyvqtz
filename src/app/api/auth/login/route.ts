import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { handleError, ApiError } from "@/lib/api";
import { getRequestInfo, type RequestInfo } from "@/lib/request-info";
import { checkLock, MAX_ATTEMPTS, WINDOW_MIN } from "@/lib/login-guard";
import { isSiteEnabled } from "@/lib/settings";
import { alertSuperAdmins, suspicionOf } from "@/lib/security-alert";

const schema = z.object({
  login: z.string().min(1, "Введите логин"),
  password: z.string().min(1, "Введите пароль"),
  // Координаты приходят, только если человек разрешил геолокацию в браузере.
  // Отказ — обычное дело, тогда в журнале останется город по IP.
  gpsLat: z.number().min(-90).max(90).optional(),
  gpsLng: z.number().min(-180).max(180).optional(),
  gpsAccuracy: z.number().min(0).max(100_000).optional(),
});

type Gps = Pick<z.infer<typeof schema>, "gpsLat" | "gpsLng" | "gpsAccuracy">;

// Одна запись в журнал. Пишем и успех, и отказ: по отказам видно подбор
// пароля, и на них же держится блокировка.
async function log(
  loginTried: string,
  success: boolean,
  reason: string | null,
  info: RequestInfo,
  gps: Gps,
  userId?: string | null
) {
  try {
    await prisma.loginLog.create({
      data: {
        userId: userId ?? null,
        loginTried,
        success,
        reason,
        ip: info.ip,
        userAgent: info.userAgent,
        device: info.device,
        os: info.os,
        browser: info.browser,
        ipCity: info.ipCity,
        ipCountry: info.ipCountry,
        gpsLat: gps.gpsLat ?? null,
        gpsLng: gps.gpsLng ?? null,
        gpsAccuracy: gps.gpsAccuracy ?? null,
      },
    });
  } catch (err) {
    // Журнал важен, но не важнее самого входа: сотрудник должен попасть
    // в систему, даже если запись не легла.
    console.error("login log failed", err);
  }
}

function where(info: RequestInfo): string {
  const city = [info.ipCity, info.ipCountry].filter(Boolean).join(", ");
  return city || info.ip || "noma'lum";
}

export async function POST(req: Request) {
  const info = getRequestInfo(req);

  try {
    const body = await req.json();
    const { login, password, ...gps } = schema.parse(body);

    // ── Блокировка после серии неверных паролей ──
    const lock = await checkLock(login);
    if (lock.locked) {
      await log(login, false, "locked", info, gps);
      throw new ApiError(
        429,
        `Слишком много попыток. Повторите через ${lock.minutesLeft} мин.`
      );
    }

    const user = await prisma.user.findUnique({
      where: { login },
      include: { role: true },
    });

    // Причину пишем в журнал, но наружу отдаём один и тот же текст: иначе
    // по разнице ответов можно перебрать список существующих логинов.
    if (!user) {
      await log(login, false, "no_user", info, gps);
      throw new ApiError(401, "Неверный логин или пароль");
    }
    if (!user.isActive) {
      await log(login, false, "inactive", info, gps, user.id);
      throw new ApiError(401, "Неверный логин или пароль");
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      await log(login, false, "bad_password", info, gps, user.id);

      // Именно эта попытка стала последней каплей — предупреждаем админов.
      const after = await checkLock(login);
      if (after.locked) {
        await alertSuperAdmins("locked", [
          `Login: <b>${login}</b>`,
          `${MAX_ATTEMPTS} marta xato parol, ${WINDOW_MIN} daqiqaga bloklandi.`,
          `Qayerdan: ${where(info)}`,
          `Qurilma: ${[info.device, info.os, info.browser].filter(Boolean).join(" · ") || "noma'lum"}`,
        ]);
      }
      throw new ApiError(401, "Неверный логин или пароль");
    }

    // ── Сайт выключен суперадмином ──
    // Проверяем ПОСЛЕ пароля: иначе по разному ответу видно, существует
    // учётка или нет. Сам суперадмин заходит всегда — иначе, выключив
    // сайт, он запер бы и себя.
    if (!user.role.isSuperAdmin && !(await isSiteEnabled())) {
      await log(login, false, "site_off", info, gps, user.id);
      throw new ApiError(503, "Tizim vaqtincha o'chirilgan. Keyinroq urinib ko'ring.");
    }

    await log(login, true, null, info, gps, user.id);

    const kind = suspicionOf(info);
    if (kind) {
      await alertSuperAdmins(kind, [
        `Xodim: <b>${user.lastName} ${user.firstName}</b> (${login})`,
        `Qayerdan: ${where(info)}`,
        `Qurilma: ${[info.device, info.os, info.browser].filter(Boolean).join(" · ") || "noma'lum"}`,
      ]);
    }

    await setSessionCookie(user.id, user.tokenVersion);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message ?? "Неверные данные" },
        { status: 400 }
      );
    }
    return handleError(err);
  }
}
