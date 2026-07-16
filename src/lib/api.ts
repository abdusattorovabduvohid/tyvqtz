import { NextResponse } from "next/server";
import { getCurrentUser, type SessionUser } from "./auth";
import { can, type Action } from "./permissions";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Требует авторизованного пользователя, иначе бросает ApiError(401).
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Не авторизован");
  return user;
}

// Требует право action в секции, иначе ApiError(403).
export async function requirePermission(
  section: string,
  action: Action
): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, section, action)) {
    throw new ApiError(403, "Недостаточно прав");
  }
  return user;
}

// Унификация обработки ошибок в route handlers.
export function handleError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return NextResponse.json(
    { error: "Внутренняя ошибка сервера" },
    { status: 500 }
  );
}
