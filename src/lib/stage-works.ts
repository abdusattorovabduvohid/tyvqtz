// Разбор работ позиции и подсчёт времени.
//
// МОДЕЛЬ (как в бумажном плане): у каждой работы указан СВОЙ день позиции —
// колонка «Kun/День»: 1, 2 или 3. Работы разных цехов идут ПАРАЛЛЕЛЬНО,
// поэтому длительность позиции = число её рабочих дней (max dayTo) × 8 ч,
// а НЕ сумма часов работ. Так весь вагон укладывается в 27 дней, как в бумаге.
//
// Если дни у работ не проставлены (старые данные) — работает прежняя модель:
// работы идут последовательно, дни = ceil(суммаЧасов / 8).

import { z } from "zod";
import { HOURS_PER_DAY } from "./format";

export const workSchema = z.object({
  nameUz: z.string().min(1, "Введите название работы"),
  nameRu: z.string().optional().nullable(),
  hours: z.number().positive("Время работы должно быть больше нуля"),
  seh: z.string().optional().nullable(), // цех работы (№2, №8 …)
  workerCount: z.number().int().min(1).optional().nullable(),
  // «День» из бумаги: с какого по какой рабочий день позиции идёт работа
  dayFrom: z.number().int().min(1).optional().nullable(),
  dayTo: z.number().int().min(1).optional().nullable(),
});

export const worksSchema = z
  .array(workSchema)
  .min(1, "Добавьте хотя бы одну работу");

export type WorkInput = z.infer<typeof workSchema>;

export interface WorkDays {
  dayFrom?: number | null;
  dayTo?: number | null;
}

// Проставлены ли дни у работ позиции (новая модель) или это старые данные.
export function hasWorkDays(works: WorkDays[]): boolean {
  return works.some((w) => (w.dayFrom ?? null) !== null || (w.dayTo ?? null) !== null);
}

// Сколько рабочих дней занимает позиция: последний день её работ.
export function worksToDays(works: (WorkDays & { hours: number })[]): number {
  if (hasWorkDays(works)) {
    const last = works.reduce(
      (m, w) => Math.max(m, w.dayTo ?? w.dayFrom ?? 1),
      1
    );
    return last;
  }
  // старые данные без дней — прежняя модель: работы подряд, 8 ч = день
  const sumHours = works.reduce((a, w) => a + (w.hours || 0), 0);
  return Math.max(1, Math.ceil(sumHours / HOURS_PER_DAY));
}

// Длительность позиции в секундах = число её рабочих дней × 8 ч.
// На этом поле держится таймер этапа, число дней и план дат.
export function worksToDurationSeconds(
  works: (WorkDays & { hours: number })[]
): number {
  return worksToDays(works) * HOURS_PER_DAY * 3600;
}

// Порядковые номера работ выставляем сами — фронт их не присылает.
export function numberWorks(works: WorkInput[]) {
  return works.map((w, i) => {
    const from = w.dayFrom ?? null;
    const to = w.dayTo ?? from;
    return {
      number: i + 1,
      nameUz: w.nameUz.trim(),
      nameRu: w.nameRu?.trim() || null,
      hours: w.hours,
      seh: w.seh?.trim() || null,
      workerCount: w.workerCount ?? null,
      dayFrom: from,
      // «с 3 по 1 день» быть не может — подстраховываемся
      dayTo: to !== null && from !== null ? Math.max(from, to) : to,
    };
  });
}
