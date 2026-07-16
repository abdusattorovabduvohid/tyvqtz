import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission, handleError, ApiError } from "@/lib/api";
import { SECTIONS } from "@/lib/permissions";

const sectionKeys = SECTIONS.map((s) => s.key);
const actionEnum = z.enum(["view", "create", "update", "delete"]);

const permsSchema = z.record(z.string(), z.array(actionEnum)).refine(
  (perms) => Object.keys(perms).every((k) => sectionKeys.includes(k)),
  { message: "Неизвестная секция в правах" }
);

const createSchema = z.object({
  nameUz: z.string().min(2, "Название роли минимум 2 символа"),
  nameRu: z.string().optional().nullable(),
  isSuperAdmin: z.boolean().optional().default(false),
  permissions: permsSchema.optional().default({}),
});

export async function GET() {
  try {
    await requirePermission("roles", "view");
    const roles = await prisma.role.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true } } },
    });
    return NextResponse.json({ roles });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requirePermission("roles", "create");
    const body = await req.json();
    const data = createSchema.parse(body);

    const exists = await prisma.role.findUnique({ where: { nameUz: data.nameUz } });
    if (exists) throw new ApiError(409, "Роль с таким названием уже есть");

    const role = await prisma.role.create({
      data: {
        nameUz: data.nameUz,
        nameRu: data.nameRu || null,
        isSuperAdmin: data.isSuperAdmin ?? false,
        permissions: JSON.stringify(
          data.isSuperAdmin ? {} : data.permissions ?? {}
        ),
      },
    });
    return NextResponse.json({ role }, { status: 201 });
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
