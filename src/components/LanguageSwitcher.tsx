"use client";

import { Menu, UnstyledButton, Group, Text } from "@mantine/core";
import { IconWorld, IconChevronDown } from "@tabler/icons-react";
import { LANGS } from "@/lib/i18n/translations";
import { useI18n } from "./I18nProvider";

export function LanguageSwitcher({
  compact = false,
  onDark = false,
}: {
  compact?: boolean;
  onDark?: boolean;
}) {
  const { lang, setLang } = useI18n();
  const current = LANGS.find((l) => l.value === lang) ?? LANGS[0];

  return (
    <Menu shadow="md" width={160} position="bottom-end">
      <Menu.Target>
        <UnstyledButton
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            border: onDark
              ? "1px solid rgba(255,255,255,0.35)"
              : "1px solid var(--mantine-color-gray-3)",
            background: onDark ? "rgba(255,255,255,0.08)" : undefined,
            color: onDark ? "#ffffff" : undefined,
          }}
        >
          <Group gap={6} wrap="nowrap">
            <IconWorld size={16} />
            <Text size="sm" fw={600} c={onDark ? "white" : undefined}>
              {compact ? current.flag : `${current.flag} ${current.label}`}
            </Text>
            <IconChevronDown size={14} />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        {LANGS.map((l) => (
          <Menu.Item
            key={l.value}
            onClick={() => setLang(l.value)}
            bg={l.value === lang ? "var(--mantine-color-steel-light)" : undefined}
          >
            <Group gap={8}>
              <Text>{l.flag}</Text>
              <Text size="sm" fw={l.value === lang ? 700 : 400}>
                {l.label}
              </Text>
            </Group>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
