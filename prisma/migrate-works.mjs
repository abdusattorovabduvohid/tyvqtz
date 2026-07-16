// Разовая миграция: у позиций, заведённых до появления работ, работ нет,
// а таймер держится на durationSeconds. Чтобы ничего не сломать, каждой
// позиции даём ОДНУ работу — с её же названием и её же часами.
// Скрипт идемпотентный: позиции, у которых работы уже есть, пропускаются.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  let stagesFixed = 0;
  let wagonStagesFixed = 0;

  const stages = await prisma.stage.findMany({ include: { works: true } });
  for (const s of stages) {
    if (s.works.length > 0) continue;
    await prisma.stageWork.create({
      data: {
        stageId: s.id,
        number: 1,
        nameUz: s.nameUz,
        nameRu: s.nameRu,
        hours: s.durationSeconds / 3600,
      },
    });
    stagesFixed++;
  }

  const wagonStages = await prisma.wagonStage.findMany({ include: { works: true } });
  for (const ws of wagonStages) {
    if (ws.works.length > 0) continue;
    await prisma.wagonStageWork.create({
      data: {
        wagonStageId: ws.id,
        number: 1,
        nameUz: ws.nameUz,
        nameRu: ws.nameRu,
        hours: ws.durationSeconds / 3600,
      },
    });
    wagonStagesFixed++;
  }

  console.log(`Позициям добавлено работ:        ${stagesFixed}`);
  console.log(`Этапам вагонов добавлено работ:  ${wagonStagesFixed}`);

  // проверка: сумма часов работ должна совпасть с durationSeconds позиции
  const bad = [];
  for (const s of await prisma.stage.findMany({ include: { works: true } })) {
    const sum = s.works.reduce((a, w) => a + w.hours, 0);
    if (Math.round(sum * 3600) !== s.durationSeconds) {
      bad.push(`Позиция №${s.number}: работы ${sum}ч ≠ ${s.durationSeconds / 3600}ч`);
    }
  }
  console.log(
    bad.length === 0
      ? "Проверка: часы работ совпадают с временем позиций ✓"
      : "РАСХОЖДЕНИЯ:\n  " + bad.join("\n  ")
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
