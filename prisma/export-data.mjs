// Выгрузка всей базы в JSON. Запускать ДО смены провайдера на postgresql —
// после смены клиент перестанет читать SQLite-файл.
// Парная к import-data.mjs.

import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";

const prisma = new PrismaClient();
const OUT = process.argv[2] ?? "prisma/data-dump.json";

async function main() {
  // порядок важен: при импорте родители должны идти раньше детей
  const dump = {
    roles: await prisma.role.findMany(),
    users: await prisma.user.findMany(),
    wagonTypes: await prisma.wagonType.findMany(),
    stages: await prisma.stage.findMany(),
    stageWorks: await prisma.stageWork.findMany(),
    wagons: await prisma.wagon.findMany(),
    wagonStages: await prisma.wagonStage.findMany(),
    wagonStageWorks: await prisma.wagonStageWork.findMany(),
    wagonStageAssignments: await prisma.wagonStageAssignment.findMany(),
    wagonCreationApprovals: await prisma.wagonCreationApproval.findMany(),
  };

  writeFileSync(OUT, JSON.stringify(dump, null, 2));

  for (const [k, v] of Object.entries(dump)) {
    console.log(`  ${k.padEnd(24)} ${v.length}`);
  }
  console.log(`\nСохранено: ${OUT}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
