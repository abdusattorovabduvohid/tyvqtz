// Кто сейчас в системе.
//
// В вебе нет постоянного соединения, как в телеграме: браузер забирает
// страницу и отсоединяется. Поэтому «онлайн» здесь — это «был активен в
// последние ONLINE_MIN минут», и человек, закрывший вкладку, ещё пару минут
// числится онлайн. Иначе пришлось бы держать WebSocket, а на Vercel это
// отдельный сервис и отдельные деньги ради двух минут точности.

import { prisma } from "./db";

export const ONLINE_MIN = 2; // «онлайн»
export const IDLE_MIN = 15; // «недавно был»

// Как часто разрешаем писать в базу. Без этого порога каждый запрос
// сотрудника превращался бы в UPDATE, а соединений у Supabase немного.
const WRITE_EVERY_MS = 60_000;

// Последняя запись по каждому человеку в пределах этого контейнера.
const lastWrite = new Map<string, number>();

export async function touch(userId: string): Promise<void> {
  const now = Date.now();
  const prev = lastWrite.get(userId) ?? 0;
  if (now - prev < WRITE_EVERY_MS) return;
  lastWrite.set(userId, now);

  // Отметка присутствия не должна ронять запрос, ради которого человек
  // пришёл: упало — забыли и пошли дальше.
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    });
  } catch {
    lastWrite.delete(userId);
  }
}

export type PresenceState = "online" | "idle" | "offline";

export function presenceOf(lastSeenAt: Date | null): PresenceState {
  if (!lastSeenAt) return "offline";
  const min = (Date.now() - lastSeenAt.getTime()) / 60_000;
  if (min <= ONLINE_MIN) return "online";
  if (min <= IDLE_MIN) return "idle";
  return "offline";
}
