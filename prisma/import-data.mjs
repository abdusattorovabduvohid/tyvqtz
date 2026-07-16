// Загрузка дампа из export-data.mjs в текущую базу (Postgres).
// Идемпотентно: повторный запуск ничего не ломает — записи с теми же id
// перезаписываются, лишние не плодятся.

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const prisma = new PrismaClient();
const FILE = process.argv[2] ?? "prisma/data-dump.json";

// Даты в JSON стали строками — Prisma ждёт Date.
const DATE_FIELDS = ["createdAt", "updatedAt", "startedAt", "finishedAt", "decidedAt"];
const revive = (row) => {
  const out = { ...row };
  for (const f of DATE_FIELDS) {
    if (out[f]) out[f] = new Date(out[f]);
  }
  return out;
};

// Порядок = порядок внешних ключей: родители раньше детей.
const ORDER = [
  ["roles", "role"],
  ["users", "user"],
  ["wagonTypes", "wagonType"],
  ["stages", "stage"],
  ["stageWorks", "stageWork"],
  ["wagons", "wagon"],
  ["wagonStages", "wagonStage"],
  ["wagonStageWorks", "wagonStageWork"],
  ["wagonStageAssignments", "wagonStageAssignment"],
  ["wagonCreationApprovals", "wagonCreationApproval"],
];

async function main() {
  const dump = JSON.parse(readFileSync(FILE, "utf8"));

  for (const [key, model] of ORDER) {
    const rows = dump[key] ?? [];
    for (const row of rows) {
      const data = revive(row);
      await prisma[model].upsert({
        where: { id: data.id },
        create: data,
        update: data,
      });
    }
    console.log(`  ${key.padEnd(24)} ${rows.length}`);
  }

  console.log("\nПроверка:");
  console.log(`  пользователей: ${await prisma.user.count()}`);
  console.log(`  позиций:       ${await prisma.stage.count()}`);
  console.log(`  вагонов:       ${await prisma.wagon.count()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
