import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { requirePermission, handleError, ApiError } from "@/lib/api";

const updateSchema = z.object({
  login: z.string().min(3, "Логин минимум 3 символа").optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  middleName: z.string().nullable().optional(),
  photo: z.string().nullable().optional(),
  seh: z.string().nullable().optional(),
  password: z.string().min(4).optional().or(z.literal("")),
  roleId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const me = await requirePermission("users", "update");
    const body = await req.json();
    const data = updateSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError(404, "Пользователь не найден");

    // Логин меняем только когда он действительно другой: иначе проверка
    // занятости споткнулась бы о самого этого пользователя.
    const login = data.login?.trim();
    const loginChanged = Boolean(login && login !== existing.login);
    if (loginChanged) {
      const taken = await prisma.user.findUnique({ where: { login: login! } });
      if (taken) throw new ApiError(409, "Логин уже занят");
    }

    // Сменили логин или пароль — старые данные не должны пускать в систему.
    // Новый логин/хеш закрывают вход по старым, а поднятая версия токена
    // обрывает уже открытые сессии этого человека.
    const credentialsChanged = loginChanged || Boolean(data.password);

    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        login: loginChanged ? login : undefined,
        ...(credentialsChanged
          ? { tokenVersion: { increment: 1 }, lastSeenAt: null }
          : {}),
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName,
        photo: data.photo,
        seh: data.seh === undefined ? undefined : data.seh?.trim() || null,
        roleId: data.roleId,
        isActive: data.isActive,
        ...(data.password
          ? {
              passwordHash: await hashPassword(data.password),
              passwordPlain: data.password,
            }
          : {}),
      },
      include: { role: { select: { id: true, nameRu: true, nameUz: true } } },
    });

    // Если админ поменял данные самому себе — выдаём ему свежую куку,
    // иначе поднятая версия токена выкинула бы его из панели.
    if (credentialsChanged && me.id === user.id) {
      await setSessionCookie(user.id, user.tokenVersion);
    }

    const { passwordHash, ...safe } = user;
    return NextResponse.json({ user: safe });
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

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requirePermission("users", "delete");
    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
