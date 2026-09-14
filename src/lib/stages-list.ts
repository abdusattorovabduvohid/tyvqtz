// Справочник этапов для страницы «Этапы».
//
// Отдельно от роута: этим же списком страница собирается на сервере, без
// второго похода браузера за данными.

import { prisma } from "./db";

export interface Work {
  id: string;
  number: number;
  nameRu: string | null;
  nameUz: string;
  hours: number;
  seh: string | null;
  workerCount: number | null;
  dayFrom: number | null;
  dayTo: number | null;
}

export interface Stage {
  id: string;
  number: number;
  nameRu: string | null;
  nameUz: string;
  durationSeconds: number;
  workerCount: number | null;
  note: string | null;
  works: Work[];
}

export function listStages(): Promise<Stage[]> {
  // select, а не include: createdAt/updatedAt на экране не нужны.
  return prisma.stage.findMany({
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      nameRu: true,
      nameUz: true,
      durationSeconds: true,
      workerCount: true,
      note: true,
      works: {
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          nameRu: true,
          nameUz: true,
          hours: true,
          seh: true,
          workerCount: true,
          dayFrom: true,
          dayTo: true,
        },
      },
    },
  });
}
