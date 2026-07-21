import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, handleError, ApiError } from "@/lib/api";
import { can } from "@/lib/permissions";
import { computeApproval } from "@/lib/wagon";

const schema = z.object({
  action: z.enum(["assign", "approve", "deny", "start", "finish", "reset"]),
  userIds: z.array(z.string()).optional(),
  // кто из назначенных жмёт «Старт» / «Завершить» (подмножество userIds)
  executorIds: z.array(z.string()).optional(),
  comment: z.string().optional(),
});

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { action, userIds, executorIds, comment } = schema.parse(
      await req.json()
    );

    const stage = await prisma.wagonStage.findUnique({
      where: { id: params.id },
      include: { assignments: true, wagon: { select: { creationStatus: true } } },
    });
    if (!stage) throw new ApiError(404, "Этап не найден");

    // пока создание вагона не согласовано — этапы заблокированы
    if (
      stage.wagon.creationStatus !== "approved" &&
      (action === "approve" || action === "deny" || action === "start")
    ) {
      throw new ApiError(400, "Сначала согласуйте создание вагона");
    }

    const isManager = can(user.role, "wagons", "update");
    const myAssignment = stage.assignments.find((a) => a.userId === user.id);
    // Разрешение (approve/deny) дают все назначенные, а «Старт»/«Завершить»
    // жмут только отмеченные canExecute. Управляющий — как запасной вариант.
    const isExecutor = Boolean(myAssignment?.canExecute);

    // ── Назначение исполнителей (только управляющий) ──
    if (action === "assign") {
      if (!isManager) throw new ApiError(403, "Недостаточно прав");
      if (stage.status === "in_progress" || stage.status === "done") {
        throw new ApiError(400, "Нельзя менять исполнителей запущенного этапа");
      }
      const ids = Array.from(new Set(userIds ?? []));
      // executorIds не передан — кнопки остаются у всех назначенных (как раньше)
      const execIds = executorIds ? Array.from(new Set(executorIds)) : null;
      if (execIds?.some((id) => !ids.includes(id))) {
        throw new ApiError(
          400,
          "Нажимать старт и завершение могут только ответственные за этап"
        );
      }
      await prisma.$transaction([
        prisma.wagonStageAssignment.deleteMany({
          where: { wagonStageId: stage.id },
        }),
        ...(ids.length
          ? [
              prisma.wagonStageAssignment.createMany({
                data: ids.map((uid, idx) => ({
                  wagonStageId: stage.id,
                  userId: uid,
                  order: idx,
                  decision: "pending",
                  canExecute: execIds ? execIds.includes(uid) : true,
                })),
              }),
            ]
          : []),
        prisma.wagonStage.update({
          where: { id: stage.id },
          data: { status: "pending" },
        }),
      ]);
      return NextResponse.json({ ok: true });
    }

    // ── Сброс согласований (управляющий) — снять блокировку, начать заново ──
    if (action === "reset") {
      if (!isManager) throw new ApiError(403, "Недостаточно прав");
      if (stage.status === "done")
        throw new ApiError(400, "Этап уже завершён");
      await prisma.$transaction([
        prisma.wagonStageAssignment.updateMany({
          where: { wagonStageId: stage.id },
          data: { decision: "pending", comment: null, decidedAt: null },
        }),
        prisma.wagonStage.update({
          where: { id: stage.id },
          data: { status: "pending", startedAt: null, startedById: null },
        }),
      ]);
      return NextResponse.json({ ok: true });
    }

    // ── Согласование / Отказ (только назначенный исполнитель) ──
    if (action === "approve" || action === "deny") {
      if (!myAssignment) throw new ApiError(403, "Вы не назначены на этот этап");
      if (stage.status !== "pending") {
        throw new ApiError(400, "Согласование сейчас недоступно");
      }
      if (action === "deny") {
        const text = (comment ?? "").trim();
        if (text.length < 3) {
          throw new ApiError(400, "Укажите причину отказа (от 3 символов)");
        }
        await prisma.$transaction([
          prisma.wagonStageAssignment.update({
            where: { id: myAssignment.id },
            data: { decision: "denied", comment: text, decidedAt: new Date() },
          }),
          // отказ останавливает этап (и вагон)
          prisma.wagonStage.update({
            where: { id: stage.id },
            data: { status: "blocked" },
          }),
        ]);
        return NextResponse.json({ ok: true });
      }
      // approve — строго по очереди: предыдущие (по order) должны уже одобрить
      const earlier = stage.assignments.filter(
        (a) => a.order < myAssignment.order
      );
      const someoneNotApproved = earlier.some((a) => a.decision !== "approved");
      if (someoneNotApproved) {
        throw new ApiError(
          400,
          "Дождитесь разрешения предыдущих ответственных (по очереди)"
        );
      }
      await prisma.wagonStageAssignment.update({
        where: { id: myAssignment.id },
        data: { decision: "approved", comment: null, decidedAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    // ── Старт (только отмеченный исполнитель или управляющий) ──
    if (action === "start") {
      if (!isManager && !isExecutor)
        throw new ApiError(
          403,
          "Запускать этап может только назначенный исполнитель"
        );
      if (stage.status === "in_progress")
        throw new ApiError(400, "Этап уже запущен");
      if (stage.status === "done") throw new ApiError(400, "Этап уже завершён");
      if (stage.status === "blocked")
        throw new ApiError(400, "Этап заблокирован отказом — нужен сброс");

      if (stage.assignments.length === 0)
        throw new ApiError(400, "Сначала назначьте исполнителей на этап");

      const ap = computeApproval(stage.assignments);
      if (!ap.allApproved) {
        throw new ApiError(
          400,
          `Получены не все разрешения (${ap.approved}/${ap.total})`
        );
      }

      // последовательность: предыдущий этап должен быть завершён
      if (stage.number > 1) {
        const prev = await prisma.wagonStage.findUnique({
          where: {
            wagonId_number: { wagonId: stage.wagonId, number: stage.number - 1 },
          },
        });
        if (prev && prev.status !== "done") {
          throw new ApiError(400, `Сначала завершите этап №${stage.number - 1}`);
        }
      }

      const updated = await prisma.wagonStage.update({
        where: { id: stage.id },
        data: {
          status: "in_progress",
          startedAt: new Date(),
          startedById: user.id,
          finishedAt: null,
          finishedById: null,
        },
      });
      return NextResponse.json({ stage: updated });
    }

    // ── Завершение (только отмеченный исполнитель или управляющий) ──
    if (action === "finish") {
      if (!isManager && !isExecutor)
        throw new ApiError(
          403,
          "Завершать этап может только назначенный исполнитель"
        );
      if (stage.status !== "in_progress")
        throw new ApiError(400, "Этап не запущен");
      // При завершении обязательна причина отклонения от норматива —
      // и когда просрочено, и когда завершают раньше срока.
      const text = (comment ?? "").trim();
      if (text.length < 3) {
        throw new ApiError(
          400,
          "Укажите причину: почему этап завершён с отклонением от норматива"
        );
      }
      const updated = await prisma.wagonStage.update({
        where: { id: stage.id },
        data: {
          status: "done",
          finishedAt: new Date(),
          finishedById: user.id,
          finishComment: text,
        },
      });
      return NextResponse.json({ stage: updated });
    }

    throw new ApiError(400, "Неизвестное действие");
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
