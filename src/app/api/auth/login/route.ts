import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { handleError, ApiError } from "@/lib/api";
import { getRequestInfo, type RequestInfo } from "@/lib/request-info";
import { checkLock, MAX_ATTEMPTS, WINDOW_MIN } from "@/lib/login-guard";
import { isSiteEnabled } from "@/lib/settings";
import { alertSuperAdmins, suspicionOf } from "@/lib/security-alert";
import {
  checkDevice,
  deviceIdFromCookie,
  setDeviceCookie,
} from "@/lib/device-guard";

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

    // ── Тот же логин с чужого телефона ──
    //
    // Пароль верный, но устройство не одобрено — не пускаем. Открытую сессию
    // хозяина учётки на его обычном телефоне не трогаем: если это ложная
    // тревога (почистил браузер), работа не встанет.
    const deviceId = deviceIdFromCookie();
    setDeviceCookie(deviceId);
    const verdict = await checkDevice(user.id, deviceId, info, {
      alwaysAllow: user.role.isSuperAdmin,
    });
    if (!verdict.allowed) {
      await log(login, false, "new_device", info, gps, user.id);
      if (verdict.firstAttempt) {
        await alertSuperAdmins("device", [
          `Xodim: <b>${user.lastName} ${user.firstName}</b> (${login})`,
          `Yangi qurilma: ${[info.device, info.os, info.browser].filter(Boolean).join(" · ") || "noma'lum"}`,
          `Qayerdan: ${where(info)}`,
          "Kiritilmadi. Ruxsat berish — nazorat panelida.",
        ]);
      }
      throw new ApiError(
        403,
        "Bu qurilmadan kirishga ruxsat yo'q. Administratorga murojaat qiling."
      );
    }

    // ── Сайт выключен суперадмином ──
    //
    // Пароль верный, значит человек — тот, за кого себя выдаёт, и сессию мы
    // ему выдаём. Дальше его встретит страница-заглушка: она объясняет, что
    // идут технические работы, вместо красной ошибки «не удалось войти».
    // Делать что-либо он всё равно не сможет — requireUser и layout
    // дашборда закрыты. Зато когда систему включат обратно, повторно
    // логиниться не придётся.
    //
    // Проверку делаем ПОСЛЕ пароля намеренно: иначе по разнице ответов
    // можно перебрать список существующих логинов. Суперадмина не
    // ограничиваем — иначе, выключив сайт, он запер бы и себя.
    const siteOff = !user.role.isSuperAdmin && !(await isSiteEnabled());

    await log(login, true, siteOff ? "site_off" : null, info, gps, user.id);

    const kind = suspicionOf(info);
    if (kind) {
      await alertSuperAdmins(kind, [
        `Xodim: <b>${user.lastName} ${user.firstName}</b> (${login})`,
        `Qayerdan: ${where(info)}`,
        `Qurilma: ${[info.device, info.os, info.browser].filter(Boolean).join(" · ") || "noma'lum"}`,
      ]);
      // О работе вне смены уже сообщили этим же сообщением: закрываем сутки,
      // чтобы через минуту не прилетела вдогонку тревога об активности.
      if (kind === "offhours") {
        await prisma.user.update({
          where: { id: user.id },
          data: { offHoursAlertAt: new Date() },
        });
      }
    }

    await setSessionCookie(user.id, user.tokenVersion);
    return NextResponse.json({ ok: true, siteOff });
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
