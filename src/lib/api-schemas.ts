import { z } from "zod";

// Схемы тел запросов, которые интерфейс шлёт в API.
//
// Единственный источник правды: маршрут проверяет по этой схеме, страница
// берёт отсюда же тип для своих обработчиков. Раньше тело помечали как `any`,
// и опечатка в действии («aprove») или забытый comment у отказа всплывали
// только на сервере — ошибкой у сотрудника, а не у разработчика.
//
// Клиент берёт отсюда только типы (`import type`) — zod при сборке страницы
// вырезается и в бандл не попадает.

/** PATCH /api/wagon-stages/[id] — действия над позицией вагона. */
export const stageActionSchema = z.object({
  action: z.enum([
    "approve",
    "deny",
    "start",
    "finish",
    "signoff", // приёмка одного рабочего дня позиции
  ]),
  comment: z.string().optional(),
  // для signoff: какой день принимаем и решение
  dayIndex: z.number().int().min(1).optional(),
  // accepted — принять, rejected — не принять (нужен comment), none — снять подпись
  decision: z.enum(["accepted", "rejected", "none"]).optional(),
});
export type StageAction = z.infer<typeof stageActionSchema>;

/** PATCH /api/wagons/[id]/creation — согласование создания вагона. */
export const creationActionSchema = z.object({
  action: z.enum(["approve", "deny", "reset"]),
  comment: z.string().optional(),
});
export type CreationAction = z.infer<typeof creationActionSchema>;
