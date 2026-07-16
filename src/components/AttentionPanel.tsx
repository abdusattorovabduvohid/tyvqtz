"use client";

import Link from "next/link";
import { Card, Text, Group, Box, Center, ThemeIcon, Stack } from "@mantine/core";
import { IconCircleCheck, IconArrowRight } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { useI18n } from "./I18nProvider";
import { pickName } from "@/lib/i18n/translations";
import type { AttentionItem } from "@/lib/dashboard";

const STYLE = {
  blocked: { dot: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  deadline: { dot: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
  creation: { dot: "#d97706", bg: "#fffbeb", border: "#fde68a" },
} as const;

export function AttentionPanel({ items }: { items: AttentionItem[] }) {
  const { t, lang } = useI18n();

  return (
    <Card p="lg" h="100%">
      <Group gap="sm" mb={2}>
        <Text fw={800} size="15px">
          {t("home.attention")}
        </Text>
      </Group>
      <Text size="xs" c="dimmed" mb="sm">
        {t("home.attention.sub")}
      </Text>

      {items.length === 0 ? (
        <Center py={40}>
          <Stack align="center" gap={8}>
            <ThemeIcon size={44} radius="xl" variant="light" color="teal">
              <IconCircleCheck size={24} />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              {t("home.attention.empty")}
            </Text>
          </Stack>
        </Center>
      ) : (
        <Stack gap={9}>
          {items.map((it, i) => {
            const s = STYLE[it.kind];
            const stageName = it.stage ? pickName(it.stage, lang) : "";
            return (
              <motion.div
                key={`${it.kind}-${it.wagon.id}-${it.stage?.number ?? 0}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.07, duration: 0.3 }}
                whileHover={{ x: 3 }}
              >
                <Box
                  component={Link}
                  href={`/dashboard/wagons/${it.wagon.id}`}
                  p={11}
                  style={{
                    display: "flex",
                    gap: 11,
                    alignItems: "flex-start",
                    borderRadius: 11,
                    background: s.bg,
                    border: `1px solid ${s.border}`,
                    textDecoration: "none",
                  }}
                >
                  <Box
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: s.dot,
                      marginTop: 5,
                      flex: "none",
                    }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Text fw={700} size="13px" c="#14264f">
                      {pickName(it.wagon, lang)} · №{it.wagon.number}
                    </Text>
                    <Text size="11.5px" c="dimmed" mt={2} lh={1.45}>
                      {it.kind === "blocked" && (
                        <>
                          {t("home.att.blocked", { n: it.stage?.number ?? 0, name: stageName })}
                          {it.by && ` · ${t("home.att.by", { who: it.by })}`}
                          {it.comment && (
                            <>
                              <br />
                              «{it.comment}»
                            </>
                          )}
                        </>
                      )}
                      {it.kind === "deadline" &&
                        ((it.daysLeft ?? 0) <= 0
                          ? t("home.att.overdueDays", { n: Math.abs(it.daysLeft ?? 0) })
                          : t("home.att.deadline", { n: it.daysLeft ?? 0 }))}
                      {it.kind === "creation" && t("home.att.creation")}
                    </Text>
                  </div>
                  <Group gap={3} style={{ flex: "none", paddingTop: 2 }}>
                    <Text size="11px" fw={700} c="steel.6">
                      {t("home.att.open")}
                    </Text>
                    <IconArrowRight size={12} color="var(--mantine-color-steel-6)" />
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
