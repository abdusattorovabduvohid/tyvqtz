import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, handleError } from "@/lib/api";
import {
  computeStageState,
  computeApproval,
  resolveStageStatus,
} from "@/lib/wagon";

// Этапы, назначенные текущему пользователю (для его рабочего интерфейса).
export async function GET() {
  try {
    const user = await requireUser();
    const stages = await prisma.wagonStage.findMany({
      where: {
        assignments: { some: { userId: user.id } },
        // этапы видны только после согласования создания вагона
        wagon: { creationStatus: "approved" },
      },
      orderBy: [{ wagonId: "asc" }, { number: "asc" }],
      include: {
        assignments: {
          include: {
            user: {
              select: { firstName: true, lastName: true, middleName: true },
            },
          },
        },
        startedBy: {
          select: { firstName: true, lastName: true, middleName: true },
        },
        finishedBy: {
          select: { firstName: true, lastName: true, middleName: true },
        },
        wagon: {
          select: {
            id: true,
            nameRu: true,
            nameUz: true,
            number: true,
            wagonType: { select: { nameRu: true, nameUz: true } },
          },
        },
      },
    });

    // Прогресс по вагонам этих этапов — чтобы показать «5 / 22» в шапке группы.
    // Считаем по ВСЕМ этапам вагона, а не только по назначенным мне.
    const wagonIds = Array.from(new Set(stages.map((s) => s.wagonId)));
    const wagonStages = await prisma.wagonStage.findMany({
      where: { wagonId: { in: wagonIds } },
      select: { wagonId: true, status: true },
    });
    const progress = new Map<string, { done: number; total: number }>();
    for (const s of wagonStages) {
      const p = progress.get(s.wagonId) ?? { done: 0, total: 0 };
      p.total += 1;
      if (s.status === "done") p.done += 1;
      progress.set(s.wagonId, p);
    }

    const fio = (u: { firstName: string; lastName: string; middleName: string | null }) =>
      [u.lastName, u.firstName, u.middleName].filter(Boolean).join(" ");

    const now = Date.now();
    const data = stages.map((s) => {
      const state = computeStageState(s, now);
      const approval = computeApproval(s.assignments);
      const status = resolveStageStatus(s.status, s.assignments, state.overdue);
      const mine = s.assignments.find((a) => a.userId === user.id);
      const denier = s.assignments.find((a) => a.decision === "denied");
      // моя очередь: все предыдущие (по order) уже одобрили
      const myTurn = mine
        ? s.assignments
            .filter((a) => a.order < mine.order)
            .every((a) => a.decision === "approved")
        : false;
      return {
        id: s.id,
        number: s.number,
        nameRu: s.nameRu,
        nameUz: s.nameUz,
        durationSeconds: s.durationSeconds,
        status,
        myDecision: mine?.decision ?? "pending",
        // разрешение даю как все, а кнопки — только если отмечен исполнителем
        canExecute: mine?.canExecute ?? false,
        myTurn,
        approval,
        startedAt: s.startedAt,
        startedBy: s.startedBy,
        finishedAt: s.finishedAt,
        finishedBy: s.finishedBy,
        finishComment: s.finishComment,
        deadline: state.deadline,
        remainingMs: state.remainingMs,
        overdue: state.overdue,
        // кто и почему остановил этап — чтобы не искать причину в вагоне
        deniedBy: denier
          ? { name: fio(denier.user), comment: denier.comment }
          : null,
        wagon: {
          ...s.wagon,
          ...(progress.get(s.wagonId) ?? { done: 0, total: 0 }),
        },
      };
    });

    // Вагоны, ожидающие согласования СОЗДАНИЯ от текущего пользователя (1-я фаза)
    const myCreationRows = await prisma.wagonCreationApproval.findMany({
      where: { userId: user.id, wagon: { creationStatus: "pending" } },
      include: {
        wagon: {
          select: {
            id: true,
            nameRu: true,
            nameUz: true,
            number: true,
            wagonType: { select: { nameRu: true, nameUz: true } },
            createdAt: true,
            creationApprovals: { select: { order: true, decision: true } },
          },
        },
      },
    });

    const creations = myCreationRows.map((row) => {
      const all = row.wagon.creationApprovals;
      const approved = all.filter((a) => a.decision === "approved").length;
      const myTurn = all
        .filter((a) => a.order < row.order)
        .every((a) => a.decision === "approved");
      return {
        wagonId: row.wagon.id,
        nameRu: row.wagon.nameRu,
        nameUz: row.wagon.nameUz,
        number: row.wagon.number,
        wagonType: row.wagon.wagonType,
        createdAt: row.wagon.createdAt,
        myDecision: row.decision,
        myTurn,
        approval: { approved, total: all.length },
      };
    });

    return NextResponse.json({ stages: data, creations, serverNow: now });
  } catch (err) {
    return handleError(err);
  }
}
