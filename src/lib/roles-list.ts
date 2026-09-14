// Список ролей для страницы «Роли».
//
// Отдельно от роута: этим же списком страница собирается на сервере, без
// второго похода браузера за данными.

import { prisma } from "./db";
import type { RoleRow } from "@/components/RoleFormModal";

export function listRoles(): Promise<RoleRow[]> {
  // select, а не include: createdAt/updatedAt на экране не нужны, а ехать
  // на телефон будут.
  return prisma.role.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nameRu: true,
      nameUz: true,
      isSuperAdmin: true,
      permissions: true,
      _count: { select: { users: true } },
    },
  });
}
