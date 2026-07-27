import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleError, ApiError } from "@/lib/api";
import { computeWagonStatus } from "@/lib/wagon";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    await requirePermission("wagons", "view");
    const wagon = await prisma.wagon.findUnique({
      where: { id: params.id },
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
    if (!wagon) throw new ApiError(404, "Вагон не найден");

    const now = Date.now();
    // статус позиции теперь ведут подписи (в API signoff): pending | in_progress | done.
    // Позиция «заблокирована» для приёмки, пока не завершён предыдущий этап.
    const doneByNumber = new Map(
      wagon.stages.map((s) => [s.number, s.status === "done"])
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

    return NextResponse.json({
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
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requirePermission("wagons", "delete");
    await prisma.wagon.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
