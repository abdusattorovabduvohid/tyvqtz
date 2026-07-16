import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, handleError, ApiError } from "@/lib/api";
import { can } from "@/lib/permissions";

const schema = z.object({
  action: z.enum(["approve", "deny", "reset"]),
  comment: z.string().optional(),
});

type Params = { params: { id: string } };

// 1-я фаза: согласование СОЗДАНИЯ вагона (по очереди).
export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { action, comment } = schema.parse(await req.json());

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
