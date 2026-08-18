"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Text, Box, Tooltip, Group } from "@mantine/core";
import { useI18n } from "./I18nProvider";
import { revealDelay } from "@/lib/anim";

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

const COUNT_UP_MS = 700;

// Число «набегает» от нуля — оживляет строку при загрузке страницы.
// Считаем сами, кадр за кадром: ради одного этого эффекта тянуть в бандл
// анимационную библиотеку не стоит.
//
// Начальное состояние — сразу итог: в серверной разметке стоит настоящее
// число, и до гидратации панель показывает правду, а не ноль.
function CountUp({ value, color }: { value: number; color: string }) {
  const [n, setN] = useState(value);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / COUNT_UP_MS);
      // easeOutCubic — резкий старт, мягкая остановка
      setN(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

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
          <Box
            key={item.key}
            component={Link}
            href={`/dashboard/wagons?status=${item.key}`}
            className="reveal-up lift-sm"
            px="lg"
            style={{
              display: "flex",
              flex: "none",
              alignItems: "baseline",
              gap: 8,
              textDecoration: "none",
              animationDelay: revealDelay(i),
              borderRight: i < ITEMS.length - 1 ? "1px solid var(--mantine-color-gray-2)" : undefined,
            }}
          >
            <CountUp value={counts[item.key]} color={item.hex} />
            <Text size="sm" c="dimmed">
              {t(`home.ws.${item.key}`)}
            </Text>
          </Box>
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
                  <div
                    className="grow-x"
                    style={{
                      background: item.hex,
                      height: "100%",
                      width: `${(value / total) * 100}%`,
                    }}
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
