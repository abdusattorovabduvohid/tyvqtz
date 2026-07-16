"use client";

import Link from "next/link";
import { Card, Text, Box, Badge, Center, Stack, ThemeIcon, Group } from "@mantine/core";
import { IconBox } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { useI18n } from "./I18nProvider";
import { pickName } from "@/lib/i18n/translations";
import type { ActiveWagonRow } from "@/lib/dashboard";

const BAR: Record<string, string> = {
  done: "#0d9488",
  in_progress: "#2f66c9",
  pending: "#9aa3b8",
  blocked: "#dc2626",
};
const BADGE: Record<string, string> = {
  done: "teal",
  in_progress: "blue",
  pending: "gray",
  blocked: "red",
};

export function ActiveWagons({ rows }: { rows: ActiveWagonRow[] }) {
  const { t, lang } = useI18n();

  return (
    <Card p="lg">
      <Text fw={800} size="15px" mb={2}>
        {t("home.active")}
      </Text>
      <Text size="xs" c="dimmed" mb="xs">
        {t("home.active.sub")}
      </Text>

      {rows.length === 0 ? (
        <Center py={40}>
          <Stack align="center" gap={8}>
            <ThemeIcon size={44} radius="xl" variant="light" color="steel">
              <IconBox size={24} />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              {t("home.wagonStats.empty")}
            </Text>
          </Stack>
        </Center>
      ) : (
        <Stack gap={0}>
          {rows.map((r, i) => {
            const pct = r.total ? (r.done / r.total) * 100 : 0;
            return (
              <motion.div
                key={r.wagon.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.3 }}
              >
                <Box
                  component={Link}
                  href={`/dashboard/wagons/${r.wagon.id}`}
                  py="sm"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                    textDecoration: "none",
                    borderBottom:
                      i < rows.length - 1 ? "1px solid var(--mantine-color-gray-1)" : undefined,
                  }}
                >
                  {/* без жёстких ширин: на телефоне строка переносится, ничего не режется */}
                  <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                    <Text fw={700} size="13.5px" c="#14264f" truncate>
                      {pickName(r.wagon, lang)}
                    </Text>
                    <Text size="11px" c="dimmed" truncate>
                      №{r.wagon.number} · {pickName(r.type, lang)}
                    </Text>
                  </div>

                  <div style={{ flex: "2 1 200px", minWidth: 0 }}>
                    <Box
                      style={{
                        height: 8,
                        borderRadius: 999,
                        background: "var(--mantine-color-gray-2)",
                        overflow: "hidden",
                      }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, ease: "easeOut", delay: 0.3 + i * 0.08 }}
                        style={{ height: "100%", background: BAR[r.status], borderRadius: 999 }}
                      />
                    </Box>
                    <Text size="11px" c="dimmed" mt={5} truncate>
                      {t("home.active.progress", { done: r.done, total: r.total })}
                      {r.creationPending
                        ? ` · ${t("home.active.creationPending")}`
                        : r.current
                          ? ` · ${t("home.active.current", {
                              n: r.current.number,
                              name: pickName(r.current, lang),
                            })}`
                          : ""}
                    </Text>
                  </div>

                  {/* хватает под самый длинный статус — «Ожидает согласования» */}
                  <Group style={{ flex: "none" }} justify="flex-end">
                    <Badge
                      variant="light"
                      color={r.creationPending ? "yellow" : BADGE[r.status]}
                    >
                      {r.creationPending
                        ? t("wagons.awaitingCreation")
                        : t(`wstatus.${r.status}`)}
                    </Badge>
                  </Group>
                </Box>
              </motion.div>
            );
          })}
        </Stack>
      )}
    </Card>
  );
}
