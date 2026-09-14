// Список вагонов для страницы «Вагоны».
//
// Лежит отдельно от роута намеренно: этим же списком страница рисуется на
// сервере, при первой отрисовке. Иначе телефон сначала тянул бы саму
// страницу, а потом ещё раз ходил за данными в /api/wagons — два похода
// через океан подряд вместо одного (до серверов ~0.4 с в каждую сторону).
//
// Формы дат — строки ISO, ровно как их отдаёт NextResponse.json: тогда
// страница и API отдают байт в байт одно и то же, и карточка вагона не
// знает, откуда приехали данные.

import { prisma } from "./db";
import { computeWagonStatus } from "./wagon";
import { wagonSchedule, stageWorkdays, businessDaysUntil } from "./format";
import type { WagonListItem } from "@/components/WagonCard";

// На чём вагон реально стоит: сначала заблокированная позиция, потом идущая,
// иначе первая незакрытая. Нужна дважды: понять, по каким позициям догружать
// подробности, и потом при сборке ответа.
function currentIndex(stages: { status: string }[]): number {
  const blocked = stages.findIndex((s) => s.status === "blocked");
  if (blocked >= 0) return blocked;
  const running = stages.findIndex((s) => s.status === "in_progress");
  if (running >= 0) return running;
  return stages.findIndex((s) => s.status !== "done");
}

function groupByStage<T extends { wagonStageId: string }>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.wagonStageId);
    if (list) list.push(row);
    else map.set(row.wagonStageId, [row]);
  }
  return map;
}

export async function listWagons(): Promise<WagonListItem[]> {
  // Первым запросом — только то, что нужно по всем позициям: по ним
  // считаются прогресс, дни и план дат. Работы и ответственных раньше
  // тянули на каждую позицию каждого вагона, а показывается в списке
  // одна текущая: на десяти позициях это уже лишние сотни строк, которые
  // едут на телефон по заводскому интернету.
  const wagons = await prisma.wagon.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      wagonType: { select: { id: true, nameRu: true, nameUz: true } },
      stages: {
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          nameRu: true,
          nameUz: true,
          status: true,
          note: true,
          workerCount: true,
          durationSeconds: true,
        },
      },
    },
  });

  // Подробности — только по текущим позициям, двумя запросами на весь
  // список, а не по запросу на каждый вагон.
  const currentIds = wagons
    .map((w) => w.stages[currentIndex(w.stages)]?.id)
    .filter((id): id is string => Boolean(id));

  const [works, assignments] = currentIds.length
    ? await Promise.all([
        // работы позиции — из них берём суммарное число рабочих и цеха
        prisma.wagonStageWork.findMany({
          where: { wagonStageId: { in: currentIds } },
          orderBy: { number: "asc" },
          select: { wagonStageId: true, workerCount: true, seh: true },
        }),
        prisma.wagonStageAssignment.findMany({
          where: { wagonStageId: { in: currentIds } },
          orderBy: { order: "asc" },
          select: {
            wagonStageId: true,
            decision: true,
            comment: true,
            decidedAt: true,
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
        }),
      ])
    : [[], []];

  const worksByStage = groupByStage(works);
  const assignsByStage = groupByStage(assignments);

  return wagons.map((w) => {
    const total = w.stages.length;
    const done = w.stages.filter((s) => s.status === "done").length;

    // Дни: этап занимает целое число рабочих дней (8 ч = 1 день).
    const daysTotal = w.stages.reduce((a, s) => a + stageWorkdays(s.durationSeconds), 0);
    const daysDone = w.stages
      .filter((s) => s.status === "done")
      .reduce((a, s) => a + stageWorkdays(s.durationSeconds), 0);

    // План дат считаем от «Ish boshlanish sanasi», а если не задана — от создания.
    const start = w.plannedStart ?? w.createdAt;
    const { plan, end } = wagonSchedule(start, w.stages.map((s) => s.durationSeconds));
    // Дата сдачи: заданная вручную либо конец плана этапов.
    const deadline = w.plannedEnd ?? end;
    const daysLeft = businessDaysUntil(deadline);

    const idx = currentIndex(w.stages);
    const current = idx >= 0 ? w.stages[idx] : null;
    const curPlan = idx >= 0 ? plan[idx] : null;
    const curWorks = current ? (worksByStage.get(current.id) ?? []) : [];
    const curAssigns = current ? (assignsByStage.get(current.id) ?? []) : [];
    const denier = curAssigns.find((a) => a.decision === "denied");

    return {
      id: w.id,
      nameRu: w.nameRu,
      nameUz: w.nameUz,
      number: w.number,
      wagonType: w.wagonType,
      status: computeWagonStatus(w.stages) as WagonListItem["status"],
      creationStatus: w.creationStatus as WagonListItem["creationStatus"],
      progress: { done, total },
      days: { done: daysDone, total: daysTotal },
      start: start.toISOString(),
      deadline: deadline.toISOString(),
      daysLeft,
      current: current
        ? {
            number: current.number,
            nameRu: current.nameRu,
            nameUz: current.nameUz,
            status: current.status,
            note: current.note,
            // работы позиции идут параллельно по цехам, поэтому людей на позиции —
            // сумма по работам; своё поле позиции берём как запасное
            workerCount:
              curWorks.reduce((a, x) => a + (x.workerCount ?? 0), 0) ||
              current.workerCount,
            sehs: [...new Set(curWorks.map((x) => x.seh).filter(Boolean))] as string[],
            // план дат текущего этапа
            plannedStart: curPlan?.start.toISOString() ?? null,
            plannedEnd: curPlan?.end.toISOString() ?? null,
          }
        : null,
      // с решением и датой — на карточке видно, кто уже поставил галочку
      assignees: curAssigns.map((a) => ({
        ...a.user,
        decision: a.decision as WagonListItem["assignees"][number]["decision"],
        decidedAt: a.decidedAt?.toISOString() ?? null,
      })),
      deniedBy: denier
        ? {
            name: [denier.user.lastName, denier.user.firstName]
              .filter(Boolean)
              .join(" "),
            comment: denier.comment,
          }
        : null,
      createdAt: w.createdAt.toISOString(),
    };
  });
}
