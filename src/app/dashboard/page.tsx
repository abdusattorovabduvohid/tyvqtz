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

  // один запрос — из него считаются все четыре блока
  const wagons = await prisma.wagon.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      wagonType: { select: { nameRu: true, nameUz: true } },
      stages: {
        orderBy: { number: "asc" },
        include: {
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
