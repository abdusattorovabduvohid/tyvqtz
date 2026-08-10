// Переносит вагоны на текущие шаблоны позиций (план 07.08.2026, 27 дней).
//
// Снимок работ вагона переписывается по шаблону: тексты, часы, цехи, число
// рабочих и КОЛОНКА «День». Длительность позиции = её последний день × 8 ч.
//
// Осторожно: вагоны, у которых уже есть приёмка дней (подписи), по умолчанию
// НЕ трогаем — иначе поедут номера дней под подписями. Чтобы переписать и их:
//   node prisma/resync-wagons.mjs --force
// Подписи за дни, которых в новом плане больше нет, при этом удаляются.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const HOURS_PER_DAY = 8;
const force = process.argv.includes("--force");

const stageDays = (works) =>
  works.reduce((m, w) => Math.max(m, w.dayTo ?? w.dayFrom ?? 1), 1);

async function main() {
  const templates = await prisma.stage.findMany({
    orderBy: { number: "asc" },
    include: { works: { orderBy: { number: "asc" } } },
  });
  if (templates.length === 0) {
    console.log("Шаблонов позиций нет — сначала запустите import-official-10.mjs");
    return;
  }
  const byNumber = new Map(templates.map((t) => [t.number, t]));
  const planDays = templates.reduce((a, t) => a + stageDays(t.works), 0);
  console.log(`Шаблон: ${templates.length} позиций, ${planDays} дн. на вагон`);

  const wagons = await prisma.wagon.findMany({
    include: {
      stages: {
        orderBy: { number: "asc" },
        include: { works: true, daySignoffs: true },
      },
    },
  });

  let touched = 0;
  let skipped = 0;

  for (const wagon of wagons) {
    const signed = wagon.stages.reduce((a, s) => a + s.daySignoffs.length, 0);
    if (signed > 0 && !force) {
      console.log(
        `— вагон №${wagon.number}: пропущен, есть приёмка (${signed} подписей). Нужен --force`
      );
      skipped++;
      continue;
    }

    for (const st of wagon.stages) {
      const tpl = byNumber.get(st.number);
      if (!tpl) {
        console.log(`  ! вагон №${wagon.number}, позиция №${st.number}: нет шаблона — пропуск`);
        continue;
      }
      const days = stageDays(tpl.works);

      await prisma.$transaction([
        prisma.wagonStageWork.deleteMany({ where: { wagonStageId: st.id } }),
        prisma.wagonStageWork.createMany({
          data: tpl.works.map((w) => ({
            wagonStageId: st.id,
            number: w.number,
            nameUz: w.nameUz,
            nameRu: w.nameRu,
            hours: w.hours,
            seh: w.seh,
            workerCount: w.workerCount,
            dayFrom: w.dayFrom,
            dayTo: w.dayTo,
          })),
        }),
        // подписи за дни, которых в новом плане уже нет
        prisma.wagonStageDaySignoff.deleteMany({
          where: { wagonStageId: st.id, dayIndex: { gt: days } },
        }),
        prisma.wagonStage.update({
          where: { id: st.id },
          data: {
            nameUz: tpl.nameUz,
            nameRu: tpl.nameRu,
            durationSeconds: days * HOURS_PER_DAY * 3600,
          },
        }),
      ]);
    }
    touched++;
    console.log(`✓ вагон №${wagon.number}: ${wagon.stages.length} позиций, ${planDays} дн.`);
  }

  console.log(`\nОбновлено вагонов: ${touched}, пропущено: ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
