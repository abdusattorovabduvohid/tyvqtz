import { NextResponse } from "next/server";
import { requireUser, handleError } from "@/lib/api";
import { listRoleOptions } from "@/lib/options";

// Список ролей (id + название) для выпадающих списков.
// Доступен любому авторизованному пользователю.
export async function GET() {
  try {
    await requireUser();
    return NextResponse.json({ roles: await listRoleOptions() });
  } catch (err) {
    return handleError(err);
  }
}
