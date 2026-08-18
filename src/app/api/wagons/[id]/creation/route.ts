import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, handleError, ApiError } from "@/lib/api";
import { creationActionSchema } from "@/lib/api-schemas";
import { can } from "@/lib/permissions";
import { notifyUsers, notifyUsersAndGroup, personName } from "@/lib/notify";

type Params = { params: { id: string } };

// 1-я фаза: согласование СОЗДАНИЯ вагона (по очереди).
export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { action, comment } = creationActionSchema.parse(await req.json());

    const wagon = await prisma.wagon.findUnique({
      where: { id: params.id },
      include: { creationApprovals: true },
    });
    if (!wagon) throw new ApiError(404, "Вагон не найден");

    const isManager = can(user.role, "wagons", "update");
    const mine = wagon.creationApprovals.find((a) => a.userId === user.id);

    // ── Сброс (управляющий): начать согласование создания заново ──
    if (action === "reset") {
      if (!isManager) throw new ApiError(403, "Недостаточно прав");
      await prisma.$transaction([
        prisma.wagonCreationApproval.updateMany({
          where: { wagonId: wagon.id },
          data: { decision: "pending", comment: null, decidedAt: null },
        }),
        prisma.wagon.update({
          where: { id: wagon.id },
          data: { creationStatus: "pending" },
        }),
      ]);
      return NextResponse.json({ ok: true });
    }

    // ── Согласование / Отказ (только согласующий) ──
    if (!mine) throw new ApiError(403, "Вы не согласующий создание этого вагона");
    if (wagon.creationStatus !== "pending") {
      throw new ApiError(400, "Согласование создания сейчас недоступно");
    }

    if (action === "deny") {
      const text = (comment ?? "").trim();
      if (text.length < 3) {
        throw new ApiError(400, "Укажите причину отказа (от 3 символов)");
      }
      await prisma.$transaction([
        prisma.wagonCreationApproval.update({
          where: { id: mine.id },
          data: { decision: "denied", comment: text, decidedAt: new Date() },
        }),
        prisma.wagon.update({
          where: { id: wagon.id },
          data: { creationStatus: "rejected" },
        }),
      ]);

      // отказ — новость для всех, кто причастен к вагону
      const others = wagon.creationApprovals
        .filter((a) => a.userId !== user.id)
        .map((a) => a.userId);
      await notifyUsersAndGroup(others, {
        title: `Vagon №${wagon.number} — rad etildi`,
        body: `${personName(user)} kelishuvni rad etdi. Sabab: ${text}`,
        url: `/dashboard/wagons/${wagon.id}`,
        tag: `wagon-denied-${wagon.id}`,
      });
      return NextResponse.json({ ok: true });
    }

    // approve — строго по очереди: предыдущие (по order) уже должны одобрить
    const earlier = wagon.creationApprovals.filter((a) => a.order < mine.order);
    if (earlier.some((a) => a.decision !== "approved")) {
      throw new ApiError(
        400,
        "Дождитесь согласования предыдущих (по очереди)"
      );
    }

    await prisma.wagonCreationApproval.update({
      where: { id: mine.id },
      data: { decision: "approved", comment: null, decidedAt: new Date() },
    });

    // если после этого ВСЕ одобрили — вагон активируется
    const others = wagon.creationApprovals.filter((a) => a.id !== mine.id);
    const allApproved = others.every((a) => a.decision === "approved");
    if (allApproved) {
      await prisma.wagon.update({
        where: { id: wagon.id },
        data: { creationStatus: "approved" },
      });
    }

    const link = `/dashboard/wagons/${wagon.id}`;
    if (allApproved) {
      // вагон пошёл в работу: зовём ответственных за 1-ю позицию
      const first = await prisma.wagonStage.findFirst({
        where: { wagonId: wagon.id },
        orderBy: { number: "asc" },
        include: { assignments: { select: { userId: true } } },
      });
      const people = [
        ...(first?.assignments.map((a) => a.userId) ?? []),
        ...wagon.creationApprovals.map((a) => a.userId),
      ];
      await notifyUsersAndGroup(people, {
        title: `Vagon №${wagon.number} — ish boshlandi`,
        body: first
          ? `Kelishuv tugadi. ${first.number}-pozitsiya «${first.nameUz}» ochildi.`
          : "Kelishuv tugadi, vagon ishga qo‘yildi.",
        url: link,
        tag: `wagon-active-${wagon.id}`,
      });
    } else {
      // очередь идёт дальше — пишем следующему согласующему
      const next = wagon.creationApprovals
        .filter((a) => a.id !== mine.id && a.decision === "pending")
        .sort((a, b) => a.order - b.order)
        .find((a) => a.order > mine.order);
      if (next) {
        await notifyUsers([next.userId], {
          title: `Vagon №${wagon.number} — navbat sizda`,
          body: `${personName(user)} tasdiqladi. Endi sizning tasdig‘ingiz kutilmoqda.`,
          url: link,
          tag: `wagon-approval-${wagon.id}`,
        });
      }
    }

    return NextResponse.json({ ok: true, activated: allApproved });
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
