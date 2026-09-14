// Список сотрудников для страницы «Пользователи».
//
// Отдельно от роута: этим же списком страница собирается на сервере, чтобы
// телефон не ходил за данными вторым заходом после самой страницы.

import { prisma } from "./db";
import type { UserRow } from "@/components/UserFormModal";

export async function listUsers(opts: {
  // Открытый пароль уходит только супер-админу. Управляющему людьми
  // хватает права задать новый — видеть чужие ему незачем.
  withPasswords: boolean;
}): Promise<UserRow[]> {
  // Перечисляем поля поимённо, а не include: у User есть telegramLinkCode —
  // одноразовый код привязки. Уйди он в список, любой, кто видит раздел,
  // смог бы привязать чужую учётку к своему чату.
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      login: true,
      firstName: true,
      lastName: true,
      middleName: true,
      photo: true,
      seh: true,
      isActive: true,
      passwordPlain: true,
      telegramChatId: true,
      telegramUsername: true,
      role: {
        select: { id: true, nameRu: true, nameUz: true, isSuperAdmin: true },
      },
      // сколько устройств подписано на web push
      _count: { select: { pushSubscriptions: true } },
    },
  });

  return users.map(({ passwordPlain, telegramChatId, _count, ...u }) => ({
    ...u,
    // сам chat id наружу не отдаём — по нему бот пишет в личку
    telegramLinked: Boolean(telegramChatId),
    pushDevices: _count.pushSubscriptions,
    ...(opts.withPasswords ? { passwordPlain } : {}),
  }));
}
