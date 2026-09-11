import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { requirePermission, handleError, ApiError } from "@/lib/api";

const createSchema = z.object({
  login: z.string().min(3, "Логин минимум 3 символа"),
  firstName: z.string().min(1, "Введите имя"),
  lastName: z.string().min(1, "Введите фамилию"),
  middleName: z.string().optional().nullable(),
  photo: z.string().optional().nullable(),
  seh: z.string().optional().nullable(), // номер цеха работника
  password: z.string().min(4, "Пароль минимум 4 символа"),
  roleId: z.string().min(1, "Выберите роль"),
});

export async function GET() {
  try {
    const me = await requirePermission("users", "view");
    // Перечисляем поля поимённо, а не include: у User есть telegramLinkCode —
    // одноразовый код привязки. Уйди он в список, любой, кто видит раздел,
    // смог бы привязать чужую учётку к своему чату.
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        login: true,
        firstName: true,
        lastName: true,
        middleName: true,
        photo: true,
        seh: true,
        isActive: true,
        passwordPlain: true,
        telegramChatId: true,
        telegramUsername: true,
        role: {
          select: { id: true, nameRu: true, nameUz: true, isSuperAdmin: true },
        },
        // сколько устройств подписано на web push
        _count: { select: { pushSubscriptions: true } },
      },
    });
    // Открытый пароль уходит только супер-админу. Управляющему людьми
    // хватает права задать новый пароль — видеть чужие ему незачем,
    // а в списке они теперь лежат все разом.
    const canSeePassword = me.role.isSuperAdmin;
    const data = users.map(
      ({ passwordPlain, telegramChatId, _count, ...u }) => ({
        ...u,
        // сам chat id наружу не отдаём — по нему бот пишет в личку
        telegramLinked: Boolean(telegramChatId),
        pushDevices: _count.pushSubscriptions,
        ...(canSeePassword ? { passwordPlain } : {}),
      })
    );
    return NextResponse.json({ users: data });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requirePermission("users", "create");
    const body = await req.json();
    const data = createSchema.parse(body);

    const exists = await prisma.user.findUnique({ where: { login: data.login } });
    if (exists) throw new ApiError(409, "Логин уже занят");

    const role = await prisma.role.findUnique({ where: { id: data.roleId } });
    if (!role) throw new ApiError(400, "Роль не найдена");

    const user = await prisma.user.create({
      data: {
        login: data.login,
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName || null,
        photo: data.photo || null,
        seh: data.seh?.trim() || null,
        passwordHash: await hashPassword(data.password),
        passwordPlain: data.password,
        roleId: data.roleId,
      },
      include: { role: { select: { id: true, nameRu: true, nameUz: true } } },
    });

    const { passwordHash, ...safe } = user;
    return NextResponse.json({ user: safe }, { status: 201 });
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
