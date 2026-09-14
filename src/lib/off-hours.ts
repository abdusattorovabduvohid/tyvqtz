// Тревога о работе в системе вне смены.
//
// Вход вне рабочего времени ловится при вводе пароля (suspicionOf), но
// сессия живёт неделю: вошедший утром может сидеть в системе хоть до
// полуночи, и ни одного входа при этом не будет. Поэтому отдельно смотрим
// на активность — первый же запрос вне смены.
//
// Сообщаем не чаще раза в сутки на человека, иначе за вечер набежал бы
// десяток одинаковых сообщений. Отметка лежит в User.offHoursAlertAt.

import { prisma } from "./db";
import {
  alertSuperAdmins,
  isWorkTime,
  tashkentDayStart,
} from "./security-alert";

interface Who {
  id: string;
  login: string;
  firstName: string;
  lastName: string;
  offHoursAlertAt: Date | null;
  role: { isSuperAdmin: boolean };
}

export async function reportOffHoursActivity(user: Who): Promise<void> {
  // Суперадмины сами получают эти сообщения — писать им о себе незачем.
  if (user.role.isSuperAdmin) return;

  const now = new Date();
  if (isWorkTime(now)) return;

  // Проверка по уже загруженной строке: в обычный вечер она отсекает все
  // запросы после первого, не трогая базу.
  const dayStart = tashkentDayStart(now);
  if (user.offHoursAlertAt && user.offHoursAlertAt >= dayStart) return;

  try {
    // Отметку ставим условием, а не чтением с последующей записью: два
    // параллельных запроса одного человека не должны отправить два
    // одинаковых сообщения.
    const claimed = await prisma.user.updateMany({
      where: {
        id: user.id,
        OR: [{ offHoursAlertAt: null }, { offHoursAlertAt: { lt: dayStart } }],
      },
      data: { offHoursAlertAt: now },
    });
    if (claimed.count === 0) return;

    await alertSuperAdmins("activity", [
      `Xodim: <b>${user.lastName} ${user.firstName}</b> (${user.login})`,
      "Ish vaqtidan tashqari tizimda ishlamoqda.",
      "Bugun bu odam haqida boshqa xabar bermaymiz.",
    ]);
  } catch (err) {
    // Тревога не должна ронять запрос, ради которого человек пришёл.
    console.error("off-hours alert failed", err);
  }
}
