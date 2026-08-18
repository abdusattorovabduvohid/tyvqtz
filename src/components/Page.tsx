"use client";

import { Group, Stack, Text, Title } from "@mantine/core";

export function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="reveal-up" style={{ maxWidth: 1200, margin: "0 auto" }}>
      {children}
    </div>
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
