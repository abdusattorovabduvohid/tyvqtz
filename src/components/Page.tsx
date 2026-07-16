"use client";

import { Group, Stack, Text, Title } from "@mantine/core";
import { motion } from "framer-motion";

export function Page({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{ maxWidth: 1200, margin: "0 auto" }}
    >
      {children}
    </motion.div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    // wrap — на телефоне кнопка уходит под заголовок, а не режется
    <Group justify="space-between" align="flex-end" mb="lg" gap="sm">
      <Stack gap={2} style={{ flex: "1 1 200px", minWidth: 0 }}>
        <Title order={2}>{title}</Title>
        {subtitle && (
          <Text c="dimmed" size="sm">
            {subtitle}
          </Text>
        )}
      </Stack>
      {action}
    </Group>
  );
}
