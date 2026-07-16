"use client";

import { Card, Center, Stack, Text, ThemeIcon, Badge } from "@mantine/core";
import { IconTools } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { Page, PageHeader } from "@/components/Page";

export function ComingSoon({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <Page>
      <PageHeader title={title} subtitle={subtitle} />
      <Card p={0}>
        <Center py={80}>
          <Stack align="center" gap="md">
            <motion.div
              animate={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <ThemeIcon size={80} radius="xl" variant="light" color="steel">
                <IconTools size={42} />
              </ThemeIcon>
            </motion.div>
            <Badge size="lg" variant="light" color="steel">
              Следующий этап разработки
            </Badge>
            <Text c="dimmed" ta="center" maw={420}>
              Этот раздел будет реализован на следующем этапе: типы вагонов,
              этапы и процесс создания вагона из 23 этапов с таймерами.
            </Text>
          </Stack>
        </Center>
      </Card>
    </Page>
  );
}
