// Карточка вагона: всё, что показывает страница одного вагона.
//
// Отдельно от роута — этими же данными страница собирается на сервере,
// чтобы телефон не ходил за ними вторым заходом после самой страницы.

import { prisma } from "./db";
import { computeWagonStatus } from "./wagon";

export interface Assignee {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  photo: string | null;
  seh: string | null;
  role: { nameRu: string | null; nameUz: string };
  canExecute: boolean;
}
export interface StageWork {
  id: string;
  number: number;
  nameRu: string | null;
  nameUz: string;
  hours: number;
  seh: string | null;
  workerCount: number | null;
  // «День» из бумаги: в какие дни позиции идёт работа (null — старые данные)
  dayFrom: number | null;
  dayTo: number | null;
}
// подпись одного дня одним человеком
export interface Signoff {
  dayIndex: number;
  userId: string;
  decision: "accepted" | "rejected";
  comment: string | null;
  signedAt: string;
}
export interface Stage {
  id: string;
  number: number;
  nameRu: string | null;
  nameUz: string;
  durationSeconds: number;
  workerCount: number | null;
  note: string | null;
  works: StageWork[];
  status: "pending" | "in_progress" | "done" | "blocked";
  locked: boolean; // предыдущий этап ещё не завершён — приёмка недоступна
  finishedAt: string | null;
  finishedBy: {
    firstName: string;
    lastName: string;
    middleName: string | null;
  } | null;
  signoffs: Signoff[];
  assignees: Assignee[];
}
export interface CreationApprover {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  photo: string | null;
  seh: string | null;
  role: { nameRu: string | null; nameUz: string };
  order: number;
  decision: "pending" | "approved" | "denied";
  comment: string | null;
  decidedAt: string | null;
}
export interface WagonDetail {
  id: string;
  nameRu: string | null;
  nameUz: string;
  number: string;
  wagonType: { nameRu: string | null; nameUz: string };
  status: string;
  creationStatus: "pending" | "approved" | "rejected";
  creationApprovers: CreationApprover[];
  createdAt: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  stages: Stage[];
}

export interface WagonDetailResponse {
  wagon: WagonDetail;
  // время сервера: по нему страница правит расхождение часов телефона
  serverNow: number;
}

// null — такого вагона нет.
export async function getWagonDetail(
  id: string,
): Promise<WagonDetailResponse | null> {
  const wagon = await prisma.wagon.findUnique({
    where: { id },
    include: {
      wagonType: { select: { id: true, nameRu: true, nameUz: true } },
      creationApprovals: {
        orderBy: { order: "asc" },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true,
              photo: true,
              seh: true,
              role: { select: { nameRu: true, nameUz: true } },
            },
          },
        },
      },
      stages: {
        orderBy: { number: "asc" },
        include: {
          works: { orderBy: { number: "asc" } },
          daySignoffs: true,
          startedBy: {
            select: { firstName: true, lastName: true, middleName: true },
          },
          finishedBy: {
            select: { firstName: true, lastName: true, middleName: true },
          },
          assignments: {
            orderBy: { order: "asc" },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  middleName: true,
                  photo: true,
                  seh: true,
                  role: { select: { nameRu: true, nameUz: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!wagon) return null;

  const now = Date.now();
  // статус позиции теперь ведут подписи (в API signoff): pending | in_progress | done.
  // Позиция «заблокирована» для приёмки, пока не завершён предыдущий этап.
  const doneByNumber = new Map(
    wagon.stages.map((s) => [s.number, s.status === "done"]),
  );
  const stages = wagon.stages.map((s) => {
    const locked = s.number > 1 && !doneByNumber.get(s.number - 1);
    return {
      id: s.id,
      number: s.number,
      nameRu: s.nameRu,
      nameUz: s.nameUz,
      durationSeconds: s.durationSeconds,
      workerCount: s.workerCount,
      note: s.note,
      works: s.works,
      status: s.status, // pending | in_progress | done
      locked, // предыдущий этап ещё не завершён — приёмка недоступна
      finishedAt: s.finishedAt,
      finishedBy: s.finishedBy,
      // подписи по дням: кто какой день принял / не принял
      signoffs: s.daySignoffs.map((d) => ({
        dayIndex: d.dayIndex,
        userId: d.userId,
        decision: d.decision, // accepted | rejected
        comment: d.comment,
        signedAt: d.signedAt,
      })),
      assignees: s.assignments.map((a) => ({
        ...a.user,
        canExecute: a.canExecute,
      })),
    };
  });

  const creationApprovers = wagon.creationApprovals.map((a) => ({
    ...a.user,
    order: a.order,
    decision: a.decision,
    comment: a.comment,
    decidedAt: a.decidedAt,
  }));

  const payload = {
    wagon: {
      id: wagon.id,
      nameRu: wagon.nameRu,
      nameUz: wagon.nameUz,
      number: wagon.number,
      wagonType: wagon.wagonType,
      status: computeWagonStatus(wagon.stages),
      creationStatus: wagon.creationStatus,
      createdAt: wagon.createdAt,
      plannedStart: wagon.plannedStart,
      plannedEnd: wagon.plannedEnd,
      creationApprovers,
      stages,
    },
    serverNow: now,
  };

  // Через JSON: даты становятся строками ровно так же, как их отдаёт
  // NextResponse.json. Страница и API обязаны давать одно и то же.
  return JSON.parse(JSON.stringify(payload)) as WagonDetailResponse;
}
