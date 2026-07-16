"use client";

import { useEffect, useState } from "react";
import {
  Modal,
  TextInput,
  Button,
  Group,
  Stack,
  Switch,
  Checkbox,
  Table,
  Text,
  Box,
  LoadingOverlay,
  Card,
  Alert,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconShieldCheck } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/client";
import { useI18n } from "@/components/I18nProvider";
import {
  SECTIONS,
  parsePermissions,
  type Action,
  type Permissions,
} from "@/lib/permissions";

export interface RoleRow {
  id: string;
  nameRu: string;
  nameUz: string | null;
  isSuperAdmin: boolean;
  permissions: string;
  _count?: { users: number };
}

const ALL_ACTIONS: Action[] = ["view", "create", "update", "delete"];

interface Props {
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: RoleRow | null;
}

export function RoleFormModal({ opened, onClose, onSaved, initial }: Props) {
  const editing = Boolean(initial);
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [nameRu, setNameRu] = useState("");
  const [nameUz, setNameUz] = useState("");
  const [isSuper, setIsSuper] = useState(false);
  const [perms, setPerms] = useState<Permissions>({});

  useEffect(() => {
    if (opened) {
      setNameRu(initial?.nameRu ?? "");
      setNameUz(initial?.nameUz ?? "");
      setIsSuper(initial?.isSuperAdmin ?? false);
      setPerms(initial ? parsePermissions(initial.permissions) : {});
    }
  }, [opened, initial]);

  function toggle(section: string, action: Action, checked: boolean) {
    setPerms((prev) => {
      const current = new Set(prev[section] ?? []);
      if (checked) {
        current.add(action);
        // выбор любого действия подразумевает просмотр
        current.add("view");
      } else {
        current.delete(action);
        if (action === "view") current.clear();
      }
      const next = { ...prev };
      if (current.size === 0) delete next[section];
      else next[section] = ALL_ACTIONS.filter((a) => current.has(a));
      return next;
    });
  }

  function toggleSectionAll(section: string, available: Action[], checked: boolean) {
    setPerms((prev) => {
      const next = { ...prev };
      if (checked) next[section] = available;
      else delete next[section];
      return next;
    });
  }

  async function handleSubmit() {
    if (nameUz.trim().length < 2) {
      notifications.show({ color: "red", message: t("roles.enterName") });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nameUz: nameUz.trim(),
        nameRu: nameRu.trim() || null,
        isSuperAdmin: isSuper,
        permissions: isSuper ? {} : perms,
      };
      if (editing && initial) {
        await apiFetch(`/api/roles/${initial.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        notifications.show({ color: "teal", message: t("roles.updated") });
      } else {
        await apiFetch("/api/roles", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        notifications.show({ color: "teal", message: t("roles.created") });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      notifications.show({ color: "red", message: e.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editing ? t("roles.modalEdit") : t("roles.modalNew")}
      size="xl"
    >
      <Box pos="relative">
        <LoadingOverlay visible={saving} />
        <Stack>
          <Group grow>
            <TextInput
              label={`${t("roles.name")} (${t("field.uz")})`}
              placeholder="Masalan: Menejer"
              withAsterisk
              value={nameUz}
              onChange={(e) => setNameUz(e.currentTarget.value)}
            />
            <TextInput
              label={`${t("roles.name")} (${t("field.ru")})`}
              placeholder={t("roles.namePlaceholder")}
              value={nameRu}
              onChange={(e) => setNameRu(e.currentTarget.value)}
            />
          </Group>

          <Card bg="var(--mantine-color-steel-light)" p="md">
            <Group justify="space-between">
              <Group gap="sm">
                <IconShieldCheck size={22} />
                <div>
                  <Text fw={600} size="sm">
                    {t("roles.superadmin")}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {t("roles.superadminDesc")}
                  </Text>
                </div>
              </Group>
              <Switch
                checked={isSuper}
                onChange={(e) => setIsSuper(e.currentTarget.checked)}
                size="md"
              />
            </Group>
          </Card>

          {!isSuper && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
            >
              <Text fw={600} size="sm" mb="xs">
                {t("roles.matrixTitle")}
              </Text>
              <Card p={0} withBorder>
                <Table verticalSpacing="sm" horizontalSpacing="md">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t("roles.colSection")}</Table.Th>
                      {ALL_ACTIONS.map((a) => (
                        <Table.Th key={a} ta="center" w={90}>
                          {t(`action.${a}`)}
                        </Table.Th>
                      ))}
                      <Table.Th ta="center" w={70}>
                        {t("roles.colAll")}
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {SECTIONS.map((s) => {
                      const selected = new Set(perms[s.key] ?? []);
                      const allChecked = s.actions.every((a) =>
                        selected.has(a)
                      );
                      return (
                        <Table.Tr key={s.key}>
                          <Table.Td>
                            <Text size="sm" fw={500}>
                              {t(`sections.${s.key}`)}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {t(`sections.${s.key}.desc`)}
                            </Text>
                          </Table.Td>
                          {ALL_ACTIONS.map((a) => (
                            <Table.Td key={a} ta="center">
                              {s.actions.includes(a) ? (
                                <Checkbox
                                  checked={selected.has(a)}
                                  onChange={(e) =>
                                    toggle(s.key, a, e.currentTarget.checked)
                                  }
                                  style={{ display: "inline-flex" }}
                                />
                              ) : (
                                <Text c="dimmed">—</Text>
                              )}
                            </Table.Td>
                          ))}
                          <Table.Td ta="center">
                            <Checkbox
                              checked={allChecked}
                              indeterminate={selected.size > 0 && !allChecked}
                              onChange={(e) =>
                                toggleSectionAll(
                                  s.key,
                                  s.actions,
                                  e.currentTarget.checked
                                )
                              }
                              style={{ display: "inline-flex" }}
                            />
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Card>
              <Alert mt="sm" color="gray" variant="light" p="xs">
                <Text size="xs">{t("roles.viewNote")}</Text>
              </Alert>
            </motion.div>
          )}

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editing ? t("common.save") : t("common.create")}
            </Button>
          </Group>
        </Stack>
      </Box>
    </Modal>
  );
}
