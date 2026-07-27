// Разбор работ позиции и подсчёт времени.
//
// МОДЕЛЬ: работы позиции идут ПОСЛЕДОВАТЕЛЬНО. Рабочий день = 8 часов
// (08:00–17:00), поэтому длительность позиции = СУММА часов её работ,
// а число дней = ceil(суммаЧасов / 8). Дни получают отдельные даты
// (см. splitWorksIntoDays в format.ts). Цех — это только «чья бригада»,
// на время он больше не влияет.

import { z } from "zod";

export const workSchema = z.object({
  nameUz: z.string().min(1, "Введите название работы"),
  nameRu: z.string().optional().nullable(),
  hours: z.number().positive("Время работы должно быть больше нуля"),
  seh: z.string().optional().nullable(), // цех работы (№2, №8 …)
  workerCount: z.number().int().min(1).optional().nullable(),
});

export const worksSchema = z
  .array(workSchema)
  .min(1, "Добавьте хотя бы одну работу");

export type WorkInput = z.infer<typeof workSchema>;

// Длительность позиции в секундах = сумма часов её работ.
// На этом поле держится таймер этапа, число дней и план дат.
export function worksToDurationSeconds(works: { hours: number }[]): number {
  const sumHours = works.reduce((a, w) => a + (w.hours || 0), 0);
  return Math.round(sumHours * 3600);
}

// Порядковые номера работ выставляем сами — фронт их не присылает.
export function numberWorks(works: WorkInput[]) {
  return works.map((w, i) => ({
    number: i + 1,
    nameUz: w.nameUz.trim(),
    nameRu: w.nameRu?.trim() || null,
    hours: w.hours,
    seh: w.seh?.trim() || null,
    workerCount: w.workerCount ?? null,
  }));
}
