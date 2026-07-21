import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission, handleError, ApiError } from "@/lib/api";
import {
  worksSchema,
  daysSchema,
  daysToDurationSeconds,
  numberWorks,
} from "@/lib/stage-works";

const updateSchema = z.object({
  number: z.number().int().min(1).optional(),
  nameUz: z.string().min(1).optional(),
  nameRu: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  // календарный срок позиции в рабочих днях
  days: daysSchema.optional(),
  // прислали работы — заменяем их целиком
  works: worksSchema.optional(),
});

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  try {
    await requirePermission("stages", "update");
    const { works, days, ...rest } = updateSchema.parse(await req.json());

    if (rest.number !== undefined) {
      const dup = await prisma.stage.findFirst({
        where: { number: rest.number, NOT: { id: params.id } },
      });
      if (dup) throw new ApiError(409, `Позиция №${rest.number} уже существует`);
    }

    // срок позиции задаётся днями
    const durationData =
      days !== undefined ? { durationSeconds: daysToDurationSeconds(days) } : {};

    if (!works) {
      const stage = await prisma.stage.update({
        where: { id: params.id },
        data: { ...rest, ...durationData },
        include: { works: { orderBy: { number: "asc" } } },
      });
      return NextResponse.json({ stage });
    }

    // Работы всегда перезаписываем целиком: так проще, чем сверять построчно,
    // и номера остаются подряд, без дыр после удалений.
    const rows = numberWorks(works);
    const [, , stage] = await prisma.$transaction([
      prisma.stageWork.deleteMany({ where: { stageId: params.id } }),
      prisma.stageWork.createMany({
        data: rows.map((w) => ({ ...w, stageId: params.id })),
      }),
      prisma.stage.update({
        where: { id: params.id },
        data: { ...rest, ...durationData },
        include: { works: { orderBy: { number: "asc" } } },
      }),
    ]);
    return NextResponse.json({ stage });
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

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requirePermission("stages", "delete");
    await prisma.stage.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
