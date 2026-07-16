import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { handleError, ApiError } from "@/lib/api";

const schema = z.object({
  login: z.string().min(1, "Введите логин"),
  password: z.string().min(1, "Введите пароль"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { login, password } = schema.parse(body);

    const user = await prisma.user.findUnique({ where: { login } });
    if (!user || !user.isActive) {
      throw new ApiError(401, "Неверный логин или пароль");
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new ApiError(401, "Неверный логин или пароль");

    await setSessionCookie(user.id);
    return NextResponse.json({ ok: true });
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
