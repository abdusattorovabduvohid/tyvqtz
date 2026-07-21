import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission, handleError, ApiError } from "@/lib/api";
import { computeWagonStatus } from "@/lib/wagon";
import { wagonSchedule, stageWorkdays, businessDaysUntil } from "@/lib/format";

const createSchema = z.object({
  nameUz: z.string().min(1, "Введите название вагона"),
  nameRu: z.string().optional().nullable(),
  number: z.string().min(1, "Введите номер вагона"),
  wagonTypeId: z.string().min(1, "Выберите тип вагона"),
  // «Ish boshlanish sanasi» / «Ish tugash sanasi» (ISO). Конец необязателен.
  plannedStart: z.string().optional().nullable(),
  plannedEnd: z.string().optional().nullable(),
  // необязательно: выбранные этапы из справочника (динамический набор).
  // если не передано — берём все.
  stageIds: z.array(z.string()).optional(),
  // ответственные за ВСЕ этапы вагона (одинаковые для всех этапов).
  userIds: z.array(z.string()).min(1, "Выберите хотя бы одного ответственного"),
  // кто из ответственных нажимает «Старт» / «Завершить» (подмножество userIds).
  executorIds: z
    .array(z.string())
    .min(1, "Выберите, кто нажимает старт и завершение"),
  // 1-я фаза: согласующие СОЗДАНИЕ вагона (по очереди).
  creationApproverIds: z
    .array(z.string())
    .min(1, "Выберите хотя бы одного согласующего создание"),
});

export async function GET() {
  try {
    await requirePermission("wagons", "view");
    const wagons = await prisma.wagon.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        wagonType: { select: { id: true, nameRu: true, nameUz: true } },
        stages: {
          orderBy: { number: "asc" },
          select: {
            number: true,
            nameRu: true,
            nameUz: true,
            status: true,
            note: true,
            workerCount: true,
            durationSeconds: true,
            // работы позиции — из них берём суммарное число рабочих и цеха
            works: {
              orderBy: { number: "asc" },
              select: { workerCount: true, seh: true },
            },
            assignments: {
              orderBy: { order: "asc" },
              select: {
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
            },
          },
        },
      },
    });

    const data = wagons.map((w) => {
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

      // На чём вагон реально стоит
      const curIdx = w.stages.findIndex((s) => s.status === "blocked");
      const idx =
        curIdx >= 0
          ? curIdx
          : w.stages.findIndex((s) => s.status === "in_progress") >= 0
            ? w.stages.findIndex((s) => s.status === "in_progress")
            : w.stages.findIndex((s) => s.status !== "done");
      const current = idx >= 0 ? w.stages[idx] : null;
      const curPlan = idx >= 0 ? plan[idx] : null;
      const denier = current?.assignments.find((a) => a.decision === "denied");

      return {
        id: w.id,
        nameRu: w.nameRu,
        nameUz: w.nameUz,
        number: w.number,
        wagonType: w.wagonType,
        status: computeWagonStatus(w.stages),
        creationStatus: w.creationStatus,
        progress: { done, total },
        days: { done: daysDone, total: daysTotal },
        start,
        deadline,
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
                current.works.reduce((a, w) => a + (w.workerCount ?? 0), 0) ||
                current.workerCount,
              sehs: [...new Set(current.works.map((w) => w.seh).filter(Boolean))] as string[],
              // план дат текущего этапа
              plannedStart: curPlan?.start ?? null,
              plannedEnd: curPlan?.end ?? null,
            }
          : null,
        // с решением и датой — на карточке видно, кто уже поставил галочку
        assignees: current
          ? current.assignments.map((a) => ({
              ...a.user,
              decision: a.decision,
              decidedAt: a.decidedAt,
            }))
          : [],
        deniedBy: denier
          ? {
              name: [denier.user.lastName, denier.user.firstName]
                .filter(Boolean)
                .join(" "),
              comment: denier.comment,
            }
          : null,
        createdAt: w.createdAt,
      };
    });

    return NextResponse.json({ wagons: data });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requirePermission("wagons", "create");
    const data = createSchema.parse(await req.json());

    const type = await prisma.wagonType.findUnique({
      where: { id: data.wagonTypeId },
    });
    if (!type) throw new ApiError(400, "Тип вагона не найден");

    // Снимок этапов из шаблона (справочника). Идут по порядку номеров.
    // Если переданы stageIds — берём только выбранные (динамический набор).
    const templates = await prisma.stage.findMany({
      where: data.stageIds?.length ? { id: { in: data.stageIds } } : undefined,
      orderBy: { number: "asc" },
      include: { works: { orderBy: { number: "asc" } } },
    });
    if (templates.length === 0) {
      throw new ApiError(
        400,
        "Сначала создайте этапы в разделе «Этапы» и выберите их"
      );
    }

    // проверяем ответственных пользователей (этапы) и согласующих создание
    const userIds = Array.from(new Set(data.userIds));
    const approverIds = Array.from(new Set(data.creationApproverIds));
    const executorIds = Array.from(new Set(data.executorIds));
    const allIds = Array.from(new Set([...userIds, ...approverIds]));

    // нажимать кнопки может только тот, кто назначен ответственным
    if (executorIds.some((id) => !userIds.includes(id))) {
      throw new ApiError(
        400,
        "Нажимать старт и завершение могут только ответственные за этапы"
      );
    }
    const usersCount = await prisma.user.count({
      where: { id: { in: allIds } },
    });
    if (usersCount !== allIds.length) {
      throw new ApiError(400, "Некоторые пользователи не найдены");
    }

    // Вагон создаётся в статусе "pending" — ждёт согласования создания (1-я фаза).
    // Одинаковые ответственные (2-я фаза) назначаются на КАЖДЫЙ этап.
    // Разрешение дают все ответственные, а кнопки жмут только executorIds.
    const wagon = await prisma.wagon.create({
      data: {
        nameUz: data.nameUz,
        nameRu: data.nameRu || null,
        number: data.number,
        wagonTypeId: data.wagonTypeId,
        plannedStart: data.plannedStart ? new Date(data.plannedStart) : null,
        plannedEnd: data.plannedEnd ? new Date(data.plannedEnd) : null,
        creationStatus: "pending",
        creationApprovals: {
          create: approverIds.map((uid, idx) => ({ userId: uid, order: idx })),
        },
        stages: {
          create: templates.map((tpl) => ({
            number: tpl.number,
            nameUz: tpl.nameUz,
            nameRu: tpl.nameRu,
            durationSeconds: tpl.durationSeconds,
            workerCount: tpl.workerCount,
            note: tpl.note,
            status: "pending",
            // снимок работ: шаблон потом поменяют, а у вагона должно
            // остаться то, по чему его реально строили
            works: {
              create: tpl.works.map((w) => ({
                number: w.number,
                nameUz: w.nameUz,
                nameRu: w.nameRu,
                hours: w.hours,
                seh: w.seh,
                workerCount: w.workerCount,
              })),
            },
            assignments: {
              create: userIds.map((uid, idx) => ({
                userId: uid,
                order: idx,
                canExecute: executorIds.includes(uid),
              })),
            },
          })),
        },
      },
      include: { stages: true },
    });

    return NextResponse.json({ wagon }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message ?? "Неверные данные" },
        { status: 400 }
      );
    }
    return handleError(err);
  }
}
