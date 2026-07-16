"use client";

import { useEffect, useState } from "react";
import { Box, Group, Text, Progress } from "@mantine/core";
import { motion } from "framer-motion";
import { formatCountdown } from "@/lib/format";
import { useI18n } from "./I18nProvider";

interface Props {
  deadline: number; // серверное время дедлайна (мс)
  durationSeconds: number;
  clockOffset: number; // serverNow - clientNowAtFetch
  variant?: "full" | "compact";
}

const PALETTE = {
  ok: { main: "#0d9488", soft: "rgba(13,148,136,0.10)", bar: "teal" },
  warn: { main: "#d97706", soft: "rgba(217,119,6,0.10)", bar: "orange" },
  danger: { main: "#dc2626", soft: "rgba(220,38,38,0.10)", bar: "red" },
} as const;

// Профессиональный таймер: крупное моноширинное время + тонкий прогресс-бар.
export function Countdown({
  deadline,
  durationSeconds,
  clockOffset,
  variant = "full",
}: Props) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now() + clockOffset);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + clockOffset), 1000);
    return () => clearInterval(id);
  }, [clockOffset]);

  const remainingMs = deadline - now;
  const overdue = remainingMs < 0;
  const ratio = Math.max(0, Math.min(1, remainingMs / (durationSeconds * 1000)));
  const elapsedPct = overdue ? 100 : (1 - ratio) * 100;

  const tone = overdue ? PALETTE.danger : ratio < 0.25 ? PALETTE.warn : PALETTE.ok;
  const label = overdue ? t("timer.over") : t("timer.left");

  if (variant === "compact") {
    return (
      <Group gap={8} wrap="nowrap">
        <motion.span
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: tone.main,
            display: "inline-block",
          }}
        />
        <Text
          ff="ui-monospace, SFMono-Regular, Menlo, monospace"
          fw={700}
          size="md"
          c={tone.main}
        >
          {formatCountdown(remainingMs)}
        </Text>
      </Group>
    );
  }

  return (
    <Box
      style={{
        background: tone.soft,
        border: `1px solid ${tone.main}33`,
        borderRadius: 14,
        padding: "10px 14px",
        minWidth: 190,
      }}
    >
      <Group justify="space-between" align="center" mb={6} wrap="nowrap">
        <Group gap={7} wrap="nowrap">
          <motion.span
            animate={
              overdue
                ? { scale: [1, 1.25, 1] }
                : { opacity: [1, 0.35, 1] }
            }
            transition={{ duration: overdue ? 0.9 : 1.6, repeat: Infinity }}
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: tone.main,
              display: "inline-block",
              boxShadow: `0 0 0 3px ${tone.main}22`,
            }}
          />
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" lts={0.4}>
            {label}
          </Text>
        </Group>
      </Group>

      <Text
        ff="ui-monospace, SFMono-Regular, Menlo, monospace"
        fw={800}
        lh={1}
        style={{ fontSize: 30, letterSpacing: 1, color: tone.main }}
      >
        {formatCountdown(remainingMs)}
      </Text>

      <Progress
        value={elapsedPct}
        color={tone.bar}
        size="sm"
        radius="xl"
        mt={10}
        striped={!overdue}
        animated={!overdue}
      />
    </Box>
  );
}
