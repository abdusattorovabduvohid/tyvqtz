import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, handleError, ApiError } from "@/lib/api";
import { can } from "@/lib/permissions";
import { computeApproval } from "@/lib/wagon";
import { stageWorkdays } from "@/lib/format";

const schema = z.object({
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

type Params = { params: { id: string } };

// Пересчёт статуса позиции по подписям. День принят, когда его подписали
// ВСЕ назначенные; позиция готова, когда приняты все её дни.
async function recomputeStageStatus(stageId: string) {
  const st = await prisma.wagonStage.findUnique({
    where: { id: stageId },
    include: { assignments: true, daySignoffs: true },
  });
  if (!st) return;
  const totalDays = stageWorkdays(st.durationSeconds);
  const assignees = st.assignments.length;

  const acceptedPerDay = (day: number) =>
    st.daySignoffs.filter((s) => s.dayIndex === day && s.decision === "accepted")
      .length;
  const anyRejected = st.daySignoffs.some((s) => s.decision === "rejected");

  let status: string = "pending";
  if (st.daySignoffs.length > 0) status = "in_progress";
  if (assignees > 0) {
    const allDaysDone = Array.from({ length: totalDays }, (_, i) => i + 1).every(
      (d) => acceptedPerDay(d) >= assignees
    );
    if (allDaysDone) status = "done";
  }
  // хотя бы один отказ — позиция остановлена, пока не переделают и не примут
  if (anyRejected && status !== "done") status = "blocked";

  await prisma.wagonStage.update({
    where: { id: stageId },
    data: {
      status,
      startedAt: st.daySignoffs.length ? st.startedAt ?? new Date() : null,
      finishedAt: status === "done" ? st.finishedAt ?? new Date() : null,
    },
  });
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { action, comment, dayIndex, decision } = schema.parse(
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

    // ── Приёмка рабочего дня: принять / не принять / снять подпись ──
    if (action === "signoff") {
      if (stage.wagon.creationStatus !== "approved") {
        throw new ApiError(400, "Сначала согласуйте создание вагона");
      }
      const me = stage.assignments.find((a) => a.userId === user.id);
      if (!me) throw new ApiError(403, "Вы не назначены на этот этап");
      if (!dayIndex) throw new ApiError(400, "Не указан день");
      const totalDays = stageWorkdays(stage.durationSeconds);
      if (dayIndex > totalDays) throw new ApiError(400, "Такого дня нет");

      const dec = decision ?? "accepted";

      // последовательность этапов: предыдущий этап должен быть завершён
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

      const allSignoffs = await prisma.wagonStageDaySignoff.findMany({
        where: { wagonStageId: stage.id },
      });
      const acceptedOn = (day: number, uid: string) =>
        allSignoffs.some(
          (s) => s.dayIndex === day && s.userId === uid && s.decision === "accepted"
        );

      // последовательность дней: день можно принимать, только когда предыдущий
      // день принят всеми (кроме первого дня)
      if (dec !== "none" && dayIndex > 1) {
        const prevDayDone = stage.assignments.every((a) =>
          acceptedOn(dayIndex - 1, a.userId)
        );
        if (!prevDayDone) {
          throw new ApiError(400, `Сначала примите день ${dayIndex - 1}`);
        }
      }

      // последовательность людей: все ответственные раньше меня (по order)
      // должны уже принять этот день
      if (dec !== "none") {
        const earlier = stage.assignments.filter((a) => a.order < me.order);
        const blockedBy = earlier.find((a) => !acceptedOn(dayIndex, a.userId));
        if (blockedBy) {
          throw new ApiError(400, "Дождитесь приёмки предыдущего ответственного");
        }
      }

      if (dec === "none") {
        await prisma.wagonStageDaySignoff.deleteMany({
          where: { wagonStageId: stage.id, dayIndex, userId: user.id },
        });
      } else {
        const text = (comment ?? "").trim();
        if (dec === "rejected" && text.length < 3) {
          throw new ApiError(400, "Укажите причину, почему день не принят (от 3 символов)");
        }
        await prisma.wagonStageDaySignoff.upsert({
          where: {
            wagonStageId_dayIndex_userId: {
              wagonStageId: stage.id,
              dayIndex,
              userId: user.id,
            },
          },
          create: {
            wagonStageId: stage.id,
            dayIndex,
            userId: user.id,
            decision: dec,
            comment: dec === "rejected" ? text : null,
          },
          update: {
            decision: dec,
            comment: dec === "rejected" ? text : null,
            signedAt: new Date(),
          },
        });
      }

      await recomputeStageStatus(stage.id);
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
