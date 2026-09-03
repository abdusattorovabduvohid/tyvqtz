// Настройки, которые суперадмин меняет на ходу, без деплоя.

import { prisma } from "./db";

export const SITE_ENABLED = "site_enabled";
export const LAST_BACKUP_AT = "last_backup_at";

// Значение читается почти на каждом запросе, поэтому держим его в памяти.
// 5 секунд — компромисс: выключение сайта доходит до всех не мгновенно, но
// без этого кэша каждый чих ходил бы в базу. На Vercel у каждого контейнера
// свой кэш, поэтому «до 5 секунд» — это про худший случай.
const TTL_MS = 5000;
let cache: { value: string | null; at: number } | null = null;

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string, updatedBy?: string) {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value, updatedBy },
    update: { value, updatedBy },
  });
  if (key === SITE_ENABLED) cache = null; // свой контейнер обновляем сразу
}

// Включён ли сайт для обычных сотрудников.
//
// По умолчанию — да: если строки в базе нет (первый запуск, чистая база),
// система обязана работать. Ошибка чтения тоже трактуется как «включён» —
// падение базы не должно выглядеть как «сайт выключили».
export async function isSiteEnabled(): Promise<boolean> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.value !== "off";

  let value: string | null = null;
  try {
    value = await getSetting(SITE_ENABLED);
  } catch {
    return true;
  }
  cache = { value, at: now };
  return value !== "off";
}

export async function setSiteEnabled(enabled: boolean, byUserId: string) {
  await setSetting(SITE_ENABLED, enabled ? "on" : "off", byUserId);
}
