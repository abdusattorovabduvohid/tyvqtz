import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, handleError } from "@/lib/api";

// Список типов вагонов (id + название) для выпадающих списков.
export async function GET() {
  try {
    await requireUser();
    const types = await prisma.wagonType.findMany({
      orderBy: { nameRu: "asc" },
      select: { id: true, nameRu: true, nameUz: true },
    });
    return NextResponse.json({ types });
  } catch (err) {
    return handleError(err);
  }
}
