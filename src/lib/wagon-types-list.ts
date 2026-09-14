// Справочник типов вагонов для страницы «Типы вагонов».
//
// Отдельно от роута: этим же списком страница собирается на сервере.

import { prisma } from "./db";

export interface WagonTypeRow {
  id: string;
  nameRu: string | null;
  nameUz: string;
  _count?: { wagons: number };
}

export function listWagonTypes(): Promise<WagonTypeRow[]> {
  // select, а не include: даты создания на экране нет.
  return prisma.wagonType.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nameRu: true,
      nameUz: true,
      _count: { select: { wagons: true } },
    },
  });
}
