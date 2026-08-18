import { SimpleGrid } from "@mantine/core";
import { prisma } from "@/lib/db";
import { Page } from "@/components/Page";
import { WagonStats } from "@/components/WagonStats";
import { AttentionPanel } from "@/components/AttentionPanel";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ActiveWagons } from "@/components/ActiveWagons";
import {
  buildCounts,
  buildAttention,
  buildActivity,
  buildActiveWagons,
} from "@/lib/dashboard";

// Главная — рабочая панель: что горит, кто что делал, где каждый вагон.
export default async function DashboardHome() {
  const user = { select: { firstName: true, lastName: true, middleName: true } };

  // Один запрос — из него считаются все четыре блока.
  //
  // Перечисляем поля через select, а не include: include тянет все колонки
  // каждой позиции каждого вагона (заметки, счётчики, служебные id), хотя
  // блокам нужна едва половина. Лишнее едет из базы на сервер и дальше в
  // HTML страницы — на заводском интернете это заметно. Набор полей совпадает
  // с WagonLike в lib/dashboard.ts, поэтому забыть нужное не выйдет: не
  // соберётся типами.
  const wagons = await prisma.wagon.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nameRu: true,
      nameUz: true,
      number: true,
      creationStatus: true,
      createdAt: true,
      plannedStart: true,
      plannedEnd: true,
      wagonType: { select: { nameRu: true, nameUz: true } },
      stages: {
        orderBy: { number: "asc" },
        select: {
          number: true,
          nameRu: true,
          nameUz: true,
          status: true,
          durationSeconds: true,
          startedAt: true,
          finishedAt: true,
          startedBy: user,
          finishedBy: user,
          assignments: {
            select: {
              decision: true,
              comment: true,
              decidedAt: true,
              user,
            },
          },
        },
      },
    },
  });

  return (
    <Page>
      <WagonStats counts={buildCounts(wagons)} />

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md" mb="md">
        <AttentionPanel items={buildAttention(wagons)} />
        <ActivityFeed items={buildActivity(wagons)} />
      </SimpleGrid>

      <ActiveWagons rows={buildActiveWagons(wagons)} />
    </Page>
  );
}
