import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission, handleError, ApiError } from "@/lib/api";

const createSchema = z.object({
  nameUz: z.string().min(1, "Введите название типа"),
  nameRu: z.string().optional().nullable(),
});

export async function GET() {
  try {
    await requirePermission("wagon-types", "view");
    const types = await prisma.wagonType.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { wagons: true } } },
    });
    return NextResponse.json({ types });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requirePermission("wagon-types", "create");
    const { nameRu, nameUz } = createSchema.parse(await req.json());

    const exists = await prisma.wagonType.findUnique({ where: { nameUz } });
    if (exists) throw new ApiError(409, "Такой тип уже существует");

    const type = await prisma.wagonType.create({
      data: { nameUz, nameRu: nameRu || null },
    });
    return NextResponse.json({ type }, { status: 201 });
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
