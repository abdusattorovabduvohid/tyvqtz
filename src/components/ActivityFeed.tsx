"use client";

import Link from "next/link";
import { Card, Text, Group, Box, Center, ThemeIcon, Stack } from "@mantine/core";
import { IconPlayerPlay, IconCheck, IconX, IconHistory } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { useI18n } from "./I18nProvider";
import { pickName } from "@/lib/i18n/translations";
import { formatDateTime } from "@/lib/format";
import type { ActivityItem } from "@/lib/dashboard";

const KIND = {
  start: { color: "#2f66c9", icon: <IconPlayerPlay size={12} /> },
  finish: { color: "#0d9488", icon: <IconCheck size={13} /> },
  deny: { color: "#dc2626", icon: <IconX size={13} /> },
} as const;

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const { t, lang } = useI18n();

  return (
    <Card p="lg" h="100%">
      <Text fw={800} size="15px" mb={2}>
        {t("home.activity")}
      </Text>
      <Text size="xs" c="dimmed" mb="sm">
        {t("home.activity.sub")}
      </Text>

      {items.length === 0 ? (
        <Center py={40}>
          <Stack align="center" gap={8}>
            <ThemeIcon size={44} radius="xl" variant="light" color="gray">
              <IconHistory size={24} />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              {t("home.activity.empty")}
            </Text>
          </Stack>
        </Center>
      ) : (
        <Stack gap={0}>
          {items.map((it, i) => {
            const k = KIND[it.kind];
            return (
              <motion.div
                key={`${it.kind}-${it.wagon.id}-${it.stage.number}-${it.at}`}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.07, duration: 0.3 }}
              >
                <Box
                  component={Link}
                  href={`/dashboard/wagons/${it.wagon.id}`}
                  py={9}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    textDecoration: "none",
                    borderBottom:
                      i < items.length - 1 ? "1px solid var(--mantine-color-gray-1)" : undefined,
                  }}
                >
                  <Box
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 999,
                      background: k.color,
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flex: "none",
                    }}
                  >
                    {k.icon}
                  </Box>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Text size="12.5px" c="#14264f" lh={1.35}>
                      <Text span fw={700}>
                        {it.by}
                      </Text>{" "}
                      {t(`home.act.${it.kind}`, {
                        n: it.stage.number,
                        name: pickName(it.stage, lang),
                      })}
                    </Text>
                    <Text size="11px" c="dimmed" lh={1.35}>
                      {pickName(it.wagon, lang)} №{it.wagon.number}
                    </Text>
                  </div>
                  <Text size="11px" c="dimmed" style={{ flex: "none", whiteSpace: "nowrap" }}>
                    {formatDateTime(it.at)}
                  </Text>
                </Box>
              </motion.div>
            );
          })}
        </Stack>
      )}
    </Card>
  );
}
