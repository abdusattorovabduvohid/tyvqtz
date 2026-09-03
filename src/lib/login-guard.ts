// Защита от подбора пароля.
//
// Считаем неудачные попытки прямо по журналу входов: отдельная таблица
// счётчиков не нужна, а данные для расследования всё равно нужно хранить.
//
// Блокируем ЛОГИН, а не IP: подбор идёт с меняющихся адресов, а цель —
// одна учётка. Побочный эффект известен: чужой человек может специально
// заблокировать сотрудника, вводя неверный пароль. Поэтому блокировка
// временная (15 минут) и никогда не требует вмешательства администратора.

import { prisma } from "./db";

export const MAX_ATTEMPTS = 5;
export const WINDOW_MIN = 15;

export interface LockState {
  locked: boolean;
  failures: number;
  /** сколько минут осталось; 0 — не заблокирован */
  minutesLeft: number;
}

export async function checkLock(loginTried: string): Promise<LockState> {
  const since = new Date(Date.now() - WINDOW_MIN * 60_000);

  // Берём попытки в окне; успешный вход сбрасывает счётчик, поэтому
  // считаем только те неудачи, что случились ПОСЛЕ последнего успеха.
  const recent = await prisma.loginLog.findMany({
    where: { loginTried, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { success: true, createdAt: true },
    take: MAX_ATTEMPTS * 2,
  });

  let failures = 0;
  let oldestFailure: Date | null = null;
  for (const row of recent) {
    if (row.success) break;
    failures += 1;
    oldestFailure = row.createdAt;
  }

  if (failures < MAX_ATTEMPTS || !oldestFailure) {
    return { locked: false, failures, minutesLeft: 0 };
  }

  // Отсчёт ведём от первой неудачи серии: отсчёт от последней позволял бы
  // держать учётку заблокированной вечно, продолжая долбить пароль.
  const unlockAt = oldestFailure.getTime() + WINDOW_MIN * 60_000;
  const msLeft = unlockAt - Date.now();
  if (msLeft <= 0) return { locked: false, failures, minutesLeft: 0 };

  return { locked: true, failures, minutesLeft: Math.ceil(msLeft / 60_000) };
}
