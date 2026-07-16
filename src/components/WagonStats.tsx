"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Text, Box, Tooltip, Group } from "@mantine/core";
import { motion, animate, useReducedMotion } from "framer-motion";
import { useI18n } from "./I18nProvider";

export interface WagonStatCounts {
  done: number;
  in_progress: number;
  pending: number;
  blocked: number;
  total: number;
}

const ITEMS = [
  { key: "done", hex: "#0d9488" },
  { key: "in_progress", hex: "#2f66c9" },
  { key: "pending", hex: "#6b7280" },
  { key: "blocked", hex: "#dc2626" },
] as const;

// Число «набегает» от нуля — оживляет строку при загрузке страницы.
function CountUp({ value, color }: { value: number; color: string }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      setN(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 0.7,
      ease: "easeOut",
      onUpdate: (v) => setN(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, reduce]);

  return (
    <Text fw={800} size="26px" c={color} lh={1}>
      {n}
    </Text>
  );
}

export function WagonStats({ counts }: { counts: WagonStatCounts }) {
  const { t } = useI18n();
  const total = counts.total || 0;

  return (
    <Card p="md" mb="md">
      {/* wrap — на узком экране счётчики переносятся, а не режутся */}
      <Group gap={0} align="center">
        {ITEMS.map((item, i) => (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
            whileHover={{ y: -2 }}
            style={{ flex: "none" }}
          >
            <Box
              component={Link}
              href={`/dashboard/wagons?status=${item.key}`}
              px="lg"
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                textDecoration: "none",
                borderRight: i < ITEMS.length - 1 ? "1px solid var(--mantine-color-gray-2)" : undefined,
              }}
            >
              <CountUp value={counts[item.key]} color={item.hex} />
              <Text size="sm" c="dimmed">
                {t(`home.ws.${item.key}`)}
              </Text>
            </Box>
          </motion.div>
        ))}

        {/* Полоса распределения — занимает остаток строки */}
        {total > 0 && (
          <Box
            ml="lg"
            mt={{ base: "sm", sm: 0 }}
            style={{
              // на телефоне полоса уезжает на свою строку во всю ширину
              flex: "1 1 160px",
              display: "flex",
              height: 7,
              borderRadius: 999,
              overflow: "hidden",
              gap: 2,
              background: "var(--mantine-color-gray-1)",
            }}
          >
            {ITEMS.map((item) => {
              const value = counts[item.key];
              if (!value) return null;
              return (
                <Tooltip
                  key={item.key}
                  label={`${t(`home.ws.${item.key}`)}: ${value}`}
                  withArrow
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(value / total) * 100}%` }}
                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
                    style={{ background: item.hex, height: "100%" }}
                  />
                </Tooltip>
              );
            })}
          </Box>
        )}
      </Group>
    </Card>
  );
}
