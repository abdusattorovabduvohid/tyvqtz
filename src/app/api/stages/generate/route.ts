import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission, handleError } from "@/lib/api";

const schema = z.object({
  count: z.number().int().min(1).max(100).optional().default(23),
  durationSeconds: z.number().int().min(1).optional().default(3600),
});

// Быстрая генерация недостающих этапов 1..count (по умолчанию 23).
export async function POST(req: Request) {
  try {
    await requirePermission("stages", "create");
    const body = await req.json().catch(() => ({}));
    const { count, durationSeconds } = schema.parse(body ?? {});

    const existing = await prisma.stage.findMany({ select: { number: true } });
    const taken = new Set(existing.map((s) => s.number));

    // У позиции время = сумма часов её работ, поэтому болванке сразу даём
    // одну работу — иначе получится позиция с нулевым временем.
    const toCreate = [];
    for (let n = 1; n <= count; n++) {
      if (!taken.has(n)) {
        toCreate.push({
          number: n,
          nameRu: `Этап ${n}`,
          nameUz: `${n}-bosqich`,
          durationSeconds,
          works: {
            create: [
              {
                number: 1,
                nameRu: `Этап ${n}`,
                nameUz: `${n}-bosqich`,
                hours: durationSeconds / 3600,
              },
            ],
          },
        });
      }
    }
    // createMany не умеет вложенные записи — создаём по одной
    for (const data of toCreate) {
      await prisma.stage.create({ data });
    }
    return NextResponse.json({ created: toCreate.length });
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
