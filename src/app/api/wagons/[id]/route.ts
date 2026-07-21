import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleError, ApiError } from "@/lib/api";
import {
  computeStageState,
  computeWagonStatus,
  computeApproval,
  resolveStageStatus,
} from "@/lib/wagon";

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
    const stages = wagon.stages.map((s) => {
      const state = computeStageState(s, now);
      const approval = computeApproval(s.assignments);
      const status = resolveStageStatus(s.status, s.assignments, state.overdue);
      return {
        id: s.id,
        number: s.number,
        nameRu: s.nameRu,
        nameUz: s.nameUz,
        durationSeconds: s.durationSeconds,
        workerCount: s.workerCount,
        note: s.note,
        works: s.works,
        status, // pending | awaiting | ready | blocked | in_progress | overdue | done
        rawStatus: s.status,
        startedAt: s.startedAt,
        startedBy: s.startedBy,
        finishedAt: s.finishedAt,
        finishedBy: s.finishedBy,
        finishComment: s.finishComment,
        deadline: state.deadline,
        remainingMs: state.remainingMs,
        overdue: state.overdue,
        approval,
        assignees: s.assignments.map((a) => ({
          ...a.user,
          decision: a.decision,
          comment: a.comment,
          decidedAt: a.decidedAt,
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
