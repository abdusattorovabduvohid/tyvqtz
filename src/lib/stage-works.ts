// Общее для позиций: разбор списка работ и подсчёт времени.
// Время позиции НЕ вводится руками — оно всегда сумма часов её работ.

import { z } from "zod";

export const workSchema = z.object({
  nameUz: z.string().min(1, "Введите название работы"),
  nameRu: z.string().optional().nullable(),
  hours: z.number().positive("Время работы должно быть больше нуля"),
});

export const worksSchema = z
  .array(workSchema)
  .min(1, "Добавьте хотя бы одну работу");

export type WorkInput = z.infer<typeof workSchema>;

// Часы работ → durationSeconds позиции. На этом поле держится таймер этапа.
export function worksToDurationSeconds(works: { hours: number }[]): number {
  const hours = works.reduce((sum, w) => sum + w.hours, 0);
  return Math.round(hours * 3600);
}

// Порядковые номера работ выставляем сами — фронт их не присылает.
export function numberWorks(works: WorkInput[]) {
  return works.map((w, i) => ({
    number: i + 1,
    nameUz: w.nameUz.trim(),
    nameRu: w.nameRu?.trim() || null,
    hours: w.hours,
  }));
}
