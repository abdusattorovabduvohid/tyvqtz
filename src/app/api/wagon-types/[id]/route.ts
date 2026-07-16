import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission, handleError, ApiError } from "@/lib/api";

const updateSchema = z.object({
  nameUz: z.string().min(1, "Введите название типа"),
  nameRu: z.string().optional().nullable(),
});

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  try {
    await requirePermission("wagon-types", "update");
    const { nameRu, nameUz } = updateSchema.parse(await req.json());

    const dup = await prisma.wagonType.findFirst({
      where: { nameUz, NOT: { id: params.id } },
    });
    if (dup) throw new ApiError(409, "Такой тип уже существует");

    const type = await prisma.wagonType.update({
      where: { id: params.id },
      data: { nameUz, nameRu: nameRu || null },
    });
    return NextResponse.json({ type });
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
    await requirePermission("wagon-types", "delete");
    const inUse = await prisma.wagon.count({ where: { wagonTypeId: params.id } });
    if (inUse > 0) {
      throw new ApiError(409, "Тип используется вагонами — нельзя удалить");
    }
    await prisma.wagonType.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
