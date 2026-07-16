import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, handleError } from "@/lib/api";

// Список пользователей (id + ФИО) для назначения на этапы.
export async function GET() {
  try {
    await requireUser();
    const users = await prisma.user.findMany({
      where: { isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, middleName: true },
    });
    return NextResponse.json({ users });
  } catch (err) {
    return handleError(err);
  }
}
