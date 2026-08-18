// Формы ответов API, которыми пользуется интерфейс.
//
// Раньше каждый такой тип существовал в двух экземплярах: маршрут собирал
// объект в массив `any[]`, а страница отдельно описывала, что она ждёт
// получить. Две копии расходились молча — например, в базе обязателен
// узбекский вариант названия, а на странице обязательным значился русский.
// Здесь описание одно, и обе стороны сверяются с ним.
//
// Названия: nameUz обязателен, nameRu может быть пустым —
// см. prisma/schema.prisma.

/** Статус позиции вагона. В базе это строка, поэтому сужаем на границе API. */
export const STAGE_STATUSES = ["pending", "in_progress", "done", "blocked"] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

export function asStageStatus(value: string): StageStatus {
  return (STAGE_STATUSES as readonly string[]).includes(value)
    ? (value as StageStatus)
    : "pending";
}

/** Решение согласующего. В базе тоже строка. */
export const DECISIONS = ["pending", "approved", "denied"] as const;
export type Decision = (typeof DECISIONS)[number];

export function asDecision(value: string): Decision {
  return (DECISIONS as readonly string[]).includes(value)
    ? (value as Decision)
    : "pending";
}

/** Вагон в сокращённом виде — шапка карточки на странице «Мои этапы». */
export interface WagonBrief {
  id: string;
  nameRu: string | null;
  nameUz: string;
  number: string;
  wagonType: { nameRu: string | null; nameUz: string };
  done: number;
  total: number;
}

/** Одна работа внутри рабочего дня позиции. */
export interface TaskWork {
  number: number;
  nameRu: string | null;
  nameUz: string;
  seh: string | null;
  workerCount: number | null;
}

/** Рабочий день, который ждёт подписи текущего сотрудника. */
export interface MyTask {
  wagon: WagonBrief;
  stageId: string;
  stageNumber: number;
  stageNameRu: string | null;
  stageNameUz: string;
  dayIndex: number;
  date: string;
  works: TaskWork[];
}

/** Позиция, на которую сотрудник назначен, — в работе или в очереди. */
export interface MyStage {
  stageId: string;
  stageNumber: number;
  stageNameRu: string | null;
  stageNameUz: string;
  status: StageStatus;
  locked: boolean;
  acceptedDays: number;
  totalDays: number;
  wagon: WagonBrief;
}

/** Вагон, создание которого ждёт согласования сотрудника. */
export interface MyCreation {
  wagonId: string;
  nameRu: string | null;
  nameUz: string;
  number: string;
  wagonType: { nameRu: string | null; nameUz: string };
  createdAt: string;
  myDecision: Decision;
  myTurn: boolean;
  approval: { approved: number; total: number };
}

/** Ответ GET /api/my-stages. */
export interface MyStagesResponse {
  tasks: MyTask[];
  mine: MyStage[];
  creations: MyCreation[];
  serverNow: number;
}
