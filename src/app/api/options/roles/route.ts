import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, handleError } from "@/lib/api";

// Список ролей (id + название) для выпадающих списков.
// Доступен любому авторизованному пользователю.
export async function GET() {
  try {
    await requireUser();
    const roles = await prisma.role.findMany({
      orderBy: { nameRu: "asc" },
      select: { id: true, nameRu: true, nameUz: true },
    });
    return NextResponse.json({ roles });
  } catch (err) {
    return handleError(err);
  }
}
