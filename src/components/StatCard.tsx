"use client";

import { Card, Group, Text, ThemeIcon } from "@mantine/core";
import {
  IconUsers,
  IconShieldHalf,
  IconTrain,
  IconBox,
} from "@tabler/icons-react";
import { motion } from "framer-motion";

const ICONS: Record<string, React.ReactNode> = {
  users: <IconUsers size={26} />,
  roles: <IconShieldHalf size={26} />,
  types: <IconTrain size={26} />,
  wagons: <IconBox size={26} />,
};

export function StatCard({
  label,
  value,
  icon,
  color,
  index,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, type: "spring", stiffness: 120 }}
      whileHover={{ y: -4 }}
    >
      <Card p="lg" h="100%">
        <Group justify="space-between">
          <div>
            <Text c="dimmed" size="sm" fw={500}>
              {label}
            </Text>
            <Text fw={800} size="28px" mt={4}>
              {value}
            </Text>
          </div>
          <ThemeIcon size={52} radius="md" variant="light" color={color}>
            {ICONS[icon]}
          </ThemeIcon>
        </Group>
      </Card>
    </motion.div>
  );
}
