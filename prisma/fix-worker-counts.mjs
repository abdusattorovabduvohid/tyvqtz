// Восстанавливает «число рабочих» и «цех» у работ — и в шаблонах позиций,
// и в снимках работ уже созданных вагонов. Сопоставление идёт по русскому
// названию работы: оно уникально внутри позиции.

import { PrismaClient } from "@prisma/client";
import { POSITIONS } from "./import-official-10.mjs";

const prisma = new PrismaClient();

/** «название работы» → { workerCount, seh } из официального плана */
const byName = new Map();
for (const p of POSITIONS) {
  for (const w of p.works) {
    byName.set(w.nameRu.trim(), { workerCount: w.workerCount, seh: w.seh });
  }
}

async function main() {
  let tpl = 0;
  for (const w of await prisma.stageWork.findMany()) {
    const src = byName.get(w.nameRu?.trim() ?? "");
    if (!src) continue;
    if (w.workerCount === src.workerCount && w.seh === src.seh) continue;
    await prisma.stageWork.update({ where: { id: w.id }, data: src });
    tpl++;
  }

  let snap = 0;
  for (const w of await prisma.wagonStageWork.findMany()) {
    const src = byName.get(w.nameRu?.trim() ?? "");
    if (!src) continue;
    if (w.workerCount === src.workerCount && w.seh === src.seh) continue;
    await prisma.wagonStageWork.update({ where: { id: w.id }, data: src });
    snap++;
  }

  console.log(`Шаблоны работ обновлены: ${tpl}`);
  console.log(`Работы вагонов обновлены: ${snap}`);

  const left = (await prisma.stageWork.findMany()).filter((w) => w.workerCount == null);
  console.log(`Без числа рабочих осталось: ${left.length}`);
  for (const w of left) console.log(`  · ${w.nameRu}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
