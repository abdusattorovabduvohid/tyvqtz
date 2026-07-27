// Пересчёт длительности позиций из СУММЫ часов работ.
//
// Новая модель: работы позиции идут последовательно, 8 ч = 1 рабочий день.
// Значит длительность позиции = сумма часов её работ (в секундах),
// а число дней = ceil(суммаЧасов / 8). Раньше бралась параллельная модель
// (календарный диапазон из бумаги) — она заменяется этой.
//
// Пересчитываем И шаблоны (Stage/StageWork), И снимки вагонов
// (WagonStage/WagonStageWork), чтобы всё считалось одинаково.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // ── шаблоны позиций ──
  const stages = await prisma.stage.findMany({ include: { works: true } });
  let tpl = 0;
  for (const s of stages) {
    const sumH = s.works.reduce((a, w) => a + (w.hours || 0), 0);
    const durationSeconds = Math.round(sumH * 3600);
    if (durationSeconds > 0 && durationSeconds !== s.durationSeconds) {
      await prisma.stage.update({ where: { id: s.id }, data: { durationSeconds } });
      tpl++;
    }
  }

  // ── снимки позиций у вагонов ──
  const wstages = await prisma.wagonStage.findMany({ include: { works: true } });
  let snap = 0;
  for (const s of wstages) {
    const sumH = s.works.reduce((a, w) => a + (w.hours || 0), 0);
    const durationSeconds = Math.round(sumH * 3600);
    // у старых вагонов могли не проставить работы — тогда не трогаем
    if (durationSeconds > 0 && durationSeconds !== s.durationSeconds) {
      await prisma.wagonStage.update({ where: { id: s.id }, data: { durationSeconds } });
      snap++;
    }
  }

  console.log(`Шаблоны позиций обновлены: ${tpl}/${stages.length}`);
  console.log(`Снимки позиций вагонов обновлены: ${snap}/${wstages.length}`);

  // контроль: сколько дней теперь на вагон (по шаблону)
  const totalDays = stages.reduce(
    (a, s) => a + Math.ceil(s.works.reduce((h, w) => h + (w.hours || 0), 0) / 8),
    0
  );
  console.log(`Итого дней на вагон (по шаблону): ${totalDays}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
