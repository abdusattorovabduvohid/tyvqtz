// Разбор работ позиции и подсчёт времени.
//
// ВАЖНО: длительность позиции — это её КАЛЕНДАРНЫЙ диапазон дней («Kun»),
// а НЕ сумма часов работ. Работы внутри позиции идут ПАРАЛЛЕЛЬНО по цехам,
// поэтому 8ч+16ч+4ч в разных цехах могут уложиться в те же 3 дня.
// В бумаге у каждой позиции своя строка «Всего … День».

import { z } from "zod";

const HOURS_PER_DAY = 8;

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

// Календарный срок позиции в рабочих днях (1, 2, 3 …).
export const daysSchema = z
  .number()
  .int()
  .min(1, "Срок позиции — минимум 1 рабочий день");

export type WorkInput = z.infer<typeof workSchema>;

// Дни позиции → durationSeconds. На этом поле держится таймер этапа и план дат.
export function daysToDurationSeconds(days: number): number {
  return days * HOURS_PER_DAY * 3600;
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
