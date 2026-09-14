// Короткие справочники для выпадающих списков.
//
// Отдельно от роутов /api/options/*, потому что теми же списками страницы
// рисуются на сервере: так первая отрисовка обходится без похода браузера
// за данными.

import { prisma } from "./db";

// Обязательное название — узбекское, русское необязательно.
export interface NameOption {
  id: string;
  nameRu: string | null;
  nameUz: string;
}

export function listWagonTypeOptions(): Promise<NameOption[]> {
  return prisma.wagonType.findMany({
    orderBy: { nameRu: "asc" },
    select: { id: true, nameRu: true, nameUz: true },
  });
}

export function listRoleOptions(): Promise<NameOption[]> {
  return prisma.role.findMany({
    orderBy: { nameRu: "asc" },
    select: { id: true, nameRu: true, nameUz: true },
  });
}
