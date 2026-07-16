"use client";

import { useRef, useState } from "react";
import {
  Stack,
  Group,
  Text,
  Paper,
  ActionIcon,
  Select,
  Badge,
  Avatar,
} from "@mantine/core";
import { IconGripVertical, IconX } from "@tabler/icons-react";
import { useI18n } from "./I18nProvider";

export interface UserOption {
  value: string;
  label: string;
}

interface Props {
  options: UserOption[];
  value: string[]; // упорядоченный список id
  onChange: (ids: string[]) => void;
}

// Список ответственных с порядковыми номерами и изменением порядка через drag&drop.
export function OrderedUserPicker({ options, value, onChange }: Props) {
  const { t } = useI18n();
  const map = new Map(options.map((o) => [o.value, o.label]));
  const dragIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const available = options.filter((o) => !value.includes(o.value));

  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    const arr = [...value];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    onChange(arr);
  }

  function remove(id: string) {
    onChange(value.filter((x) => x !== id));
  }

  function initials(label: string) {
    const parts = label.split(" ").filter(Boolean);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  }

  return (
    <Stack gap="xs">
      {value.length > 0 && (
        <Stack gap={6}>
          {value.map((id, index) => (
            <Paper
              key={id}
              withBorder
              p="xs"
              radius="md"
              draggable
              onDragStart={(e) => {
                dragIndex.current = index;
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (overIndex !== index) setOverIndex(index);
              }}
              onDragEnd={() => {
                dragIndex.current = null;
                setOverIndex(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex.current !== null) reorder(dragIndex.current, index);
                dragIndex.current = null;
                setOverIndex(null);
              }}
              style={{
                cursor: "grab",
                borderColor:
                  overIndex === index
                    ? "var(--mantine-color-steel-5)"
                    : undefined,
                background:
                  overIndex === index
                    ? "var(--mantine-color-steel-light)"
                    : undefined,
                transition: "background 120ms, border-color 120ms",
              }}
            >
              <Group gap="sm" wrap="nowrap">
                <IconGripVertical
                  size={18}
                  color="var(--mantine-color-gray-5)"
                  style={{ flexShrink: 0 }}
                />
                <Badge
                  size="lg"
                  circle
                  variant="filled"
                  color="steel"
                  style={{ flexShrink: 0 }}
                >
                  {index + 1}
                </Badge>
                <Avatar size={28} radius="xl" color="steel">
                  {initials(map.get(id) ?? "")}
                </Avatar>
                <Text size="sm" style={{ flex: 1 }} truncate>
                  {map.get(id) ?? id}
                </Text>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={() => remove(id)}
                  style={{ flexShrink: 0 }}
                >
                  <IconX size={16} />
                </ActionIcon>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      <Select
        placeholder={t("wagons.responsiblePlaceholder")}
        data={available}
        value={null}
        onChange={(v) => v && onChange([...value, v])}
        searchable
        nothingFoundMessage="—"
        disabled={available.length === 0}
      />
    </Stack>
  );
}
