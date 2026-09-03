import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handleError, requireSuperAdmin, ApiError } from "@/lib/api";

const schema = z.object({ userId: z.string().min(1) });

// Выкинуть человека из системы.
//
// Токен у нас stateless (JWT), отозвать конкретную «сессию» негде — поэтому
// увеличиваем версию токена у пользователя. Все выданные ему токены разом
// перестают проходить проверку в getCurrentUser, и на любом устройстве его
// выбросит на страницу входа.
export async function POST(req: Request) {
  try {
    const admin = await requireSuperAdmin();
    const { userId } = schema.parse(await req.json());

    // Себя выкидывать бессмысленно: следующий же запрос выбросит на логин,
    // и суперадмин решит, что панель сломалась.
    if (userId === admin.id) {
      throw new ApiError(400, "O'zingizni chiqarib bo'lmaydi");
    }

    await prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 }, lastSeenAt: null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Неверные данные" }, { status: 400 });
    }
    return handleError(err);
  }
}
