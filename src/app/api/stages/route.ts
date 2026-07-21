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

const createSchema = z.object({
  number: z.number().int().min(1, "Номер позиции от 1"),
  nameUz: z.string().min(1, "Введите название позиции"),
  nameRu: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  // календарный срок позиции в рабочих днях — из него durationSeconds
  days: daysSchema,
  works: worksSchema,
});

export async function GET() {
  try {
    await requirePermission("stages", "view");
    const stages = await prisma.stage.findMany({
      orderBy: { number: "asc" },
      include: { works: { orderBy: { number: "asc" } } },
    });
    return NextResponse.json({ stages });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requirePermission("stages", "create");
    const data = createSchema.parse(await req.json());

    const exists = await prisma.stage.findUnique({
      where: { number: data.number },
    });
    if (exists) throw new ApiError(409, `Позиция №${data.number} уже существует`);

    const works = numberWorks(data.works);
    const stage = await prisma.stage.create({
      data: {
        number: data.number,
        nameUz: data.nameUz,
        nameRu: data.nameRu || null,
        note: data.note?.trim() || null,
        durationSeconds: daysToDurationSeconds(data.days),
        works: { create: works },
      },
      include: { works: { orderBy: { number: "asc" } } },
    });
    return NextResponse.json({ stage }, { status: 201 });
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
