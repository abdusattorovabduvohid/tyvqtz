import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission, handleError, ApiError } from "@/lib/api";
import { SECTIONS } from "@/lib/permissions";

const sectionKeys = SECTIONS.map((s) => s.key);
const actionEnum = z.enum(["view", "create", "update", "delete"]);
const permsSchema = z
  .record(z.string(), z.array(actionEnum))
  .refine((perms) => Object.keys(perms).every((k) => sectionKeys.includes(k)), {
    message: "Неизвестная секция в правах",
  });

const updateSchema = z.object({
  nameUz: z.string().min(2).optional(),
  nameRu: z.string().nullable().optional(),
  isSuperAdmin: z.boolean().optional(),
  permissions: permsSchema.optional(),
});

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    await requirePermission("roles", "view");
    const role = await prisma.role.findUnique({ where: { id: params.id } });
    if (!role) throw new ApiError(404, "Роль не найдена");
    return NextResponse.json({ role });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    await requirePermission("roles", "update");
    const body = await req.json();
    const data = updateSchema.parse(body);

    const existing = await prisma.role.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError(404, "Роль не найдена");

    const role = await prisma.role.update({
      where: { id: params.id },
      data: {
        nameRu: data.nameRu,
        nameUz: data.nameUz,
        isSuperAdmin: data.isSuperAdmin,
        ...(data.permissions !== undefined || data.isSuperAdmin !== undefined
          ? {
              permissions: JSON.stringify(
                (data.isSuperAdmin ?? existing.isSuperAdmin)
                  ? {}
                  : data.permissions ?? {}
              ),
            }
          : {}),
      },
    });
    return NextResponse.json({ role });
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
    await requirePermission("roles", "delete");
    const inUse = await prisma.user.count({ where: { roleId: params.id } });
    if (inUse > 0) {
      throw new ApiError(409, "Роль назначена пользователям — нельзя удалить");
    }
    await prisma.role.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
