import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, handleError } from "@/lib/api";
import { wagonSchedule, splitWorksIntoDays } from "@/lib/format";

// Рабочий интерфейс исполнителя в новой модели приёмки по дням.
// Возвращаем:
//  tasks     — конкретные дни, которые ЖДУТ подписи именно этого пользователя
//              прямо сейчас (его очередь, день открыт, ещё не принял);
//  mine      — все назначенные ему позиции (для «в очереди» и «завершено»);
//  creations — вагоны, ждущие согласования СОЗДАНИЯ от этого пользователя.
export async function GET() {
  try {
    const user = await requireUser();

    const myStageRows = await prisma.wagonStage.findMany({
      where: {
        assignments: { some: { userId: user.id } },
        wagon: { creationStatus: "approved" },
      },
      select: { wagonId: true },
    });
    const wagonIds = Array.from(new Set(myStageRows.map((r) => r.wagonId)));

    const wagons = await prisma.wagon.findMany({
      where: { id: { in: wagonIds } },
      include: {
        wagonType: { select: { nameRu: true, nameUz: true } },
        stages: {
          orderBy: { number: "asc" },
          include: {
            works: { orderBy: { number: "asc" } },
            daySignoffs: true,
            assignments: { orderBy: { order: "asc" }, select: { userId: true, order: true } },
          },
        },
      },
    });

    const now = Date.now();
    const tasks: any[] = [];
    const mine: any[] = [];

    for (const w of wagons) {
      const start = w.plannedStart ?? w.createdAt;
      const { plan } = wagonSchedule(
        start,
        w.stages.map((s) => s.durationSeconds)
      );
      const doneCount = w.stages.filter((s) => s.status === "done").length;
      const wagonInfo = {
        id: w.id,
        nameRu: w.nameRu,
        nameUz: w.nameUz,
        number: w.number,
        wagonType: w.wagonType,
        done: doneCount,
        total: w.stages.length,
      };

      w.stages.forEach((s, idx) => {
        const me = s.assignments.find((a) => a.userId === user.id);
        if (!me) return;

        const prevDone =
          s.number === 1 ||
          w.stages.find((x) => x.number === s.number - 1)?.status === "done";
        const locked = !prevDone;

        const acceptedBy = (day: number, uid: string) =>
          s.daySignoffs.some(
            (x) => x.dayIndex === day && x.userId === uid && x.decision === "accepted"
          );
        const dayAccepted = (day: number) =>
          s.assignments.length > 0 &&
          s.assignments.every((a) => acceptedBy(day, a.userId));

        const days = splitWorksIntoDays(s.works, plan[idx].start);
        let myAcceptedDays = 0;

        for (const d of days) {
          if (dayAccepted(d.index)) myAcceptedDays++;

          const active = d.index === 1 || dayAccepted(d.index - 1);
          const myTurn = s.assignments
            .filter((a) => a.order < me.order)
            .every((a) => acceptedBy(d.index, a.userId));
          const mySignoff = s.daySignoffs.find(
            (x) => x.dayIndex === d.index && x.userId === user.id
          );
          const myDecision = mySignoff?.decision ?? "pending";

          // день ждёт именно меня: мой ход, день открыт, я ещё не принял
          if (!locked && active && myTurn && myDecision === "pending") {
            tasks.push({
              wagon: wagonInfo,
              stageId: s.id,
              stageNumber: s.number,
              stageNameRu: s.nameRu,
              stageNameUz: s.nameUz,
              dayIndex: d.index,
              date: d.date.toISOString(),
              works: d.portions.map((p) => ({
                number: p.work.number,
                nameRu: p.work.nameRu,
                nameUz: p.work.nameUz,
                seh: p.work.seh,
                workerCount: p.work.workerCount,
              })),
            });
          }
        }

        mine.push({
          stageId: s.id,
          stageNumber: s.number,
          stageNameRu: s.nameRu,
          stageNameUz: s.nameUz,
          status: s.status, // pending | in_progress | done | blocked
          locked,
          acceptedDays: myAcceptedDays,
          totalDays: days.length,
          wagon: wagonInfo,
        });
      });
    }

    // сортируем задачи по дате — ближайшие сверху
    tasks.sort((a, b) => a.date.localeCompare(b.date));

    // ── Согласование СОЗДАНИЯ вагона (1-я фаза) — без изменений ──
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

    return NextResponse.json({ tasks, mine, creations, serverNow: now });
  } catch (err) {
    return handleError(err);
  }
}
