import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { requirePermission, handleError, ApiError } from "@/lib/api";

const updateSchema = z.object({
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
    await requirePermission("users", "update");
    const body = await req.json();
    const data = updateSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError(404, "Пользователь не найден");

    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName,
        photo: data.photo,
        seh: data.seh === undefined ? undefined : data.seh?.trim() || null,
        roleId: data.roleId,
        isActive: data.isActive,
        ...(data.password
          ? { passwordHash: await hashPassword(data.password) }
          : {}),
      },
      include: { role: { select: { id: true, nameRu: true, nameUz: true } } },
    });

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
