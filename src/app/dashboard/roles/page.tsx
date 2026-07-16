"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  SimpleGrid,
  Group,
  Text,
  Badge,
  ActionIcon,
  Menu,
  Center,
  Loader,
  ThemeIcon,
  Stack,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconDots,
  IconPencil,
  IconTrash,
  IconShieldHalf,
  IconCrown,
} from "@tabler/icons-react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/client";
import { Page, PageHeader } from "@/components/Page";
import { useCan } from "@/components/UserContext";
import { useI18n } from "@/components/I18nProvider";
import { RoleFormModal, type RoleRow } from "@/components/RoleFormModal";
import { SECTIONS, parsePermissions } from "@/lib/permissions";
import { pickName } from "@/lib/i18n/translations";

export default function RolesPage() {
  const can = useCan();
  const { t, lang } = useI18n();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await apiFetch<{ roles: RoleRow[] }>("/api/roles");
      setRoles(r.roles);
    } catch (e: any) {
      notifications.show({ color: "red", message: e.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(r: RoleRow) {
    setEditing(r);
    setModalOpen(true);
  }

  function confirmDelete(r: RoleRow) {
    modals.openConfirmModal({
      title: t("roles.deleteTitle"),
      children: (
        <Text size="sm">{t("roles.deleteBody", { name: pickName(r, lang) })}</Text>
      ),
      labels: { confirm: t("common.delete"), cancel: t("common.cancel") },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await apiFetch(`/api/roles/${r.id}`, { method: "DELETE" });
          notifications.show({ color: "teal", message: t("roles.deleted") });
          load();
        } catch (e: any) {
          notifications.show({ color: "red", message: e.message });
        }
      },
    });
  }

  function sectionBadges(r: RoleRow) {
    if (r.isSuperAdmin) return null;
    const perms = parsePermissions(r.permissions);
    const keys = Object.keys(perms);
    if (keys.length === 0)
      return (
        <Text size="xs" c="dimmed">
          {t("roles.noAccess")}
        </Text>
      );
    return (
      <Group gap={6}>
        {keys.map((k) => {
          const sec = SECTIONS.find((s) => s.key === k);
          return (
            <Badge key={k} variant="light" color="gray" size="sm">
              {sec ? t(`sections.${k}`) : k}: {perms[k].length}
            </Badge>
          );
        })}
      </Group>
    );
  }

  return (
    <Page>
      <PageHeader
        title={t("roles.title")}
        subtitle={t("roles.subtitle")}
        action={
          can("roles", "create") && (
            <Button leftSection={<IconPlus size={18} />} onClick={openCreate}>
              {t("roles.create")}
            </Button>
          )
        }
      />

      {loading ? (
        <Center py={60}>
          <Loader />
        </Center>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {roles.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -3 }}
            >
            <Card p="lg" h="100%">
              <Group justify="space-between" mb="md">
                <Group gap="sm">
                  <ThemeIcon
                    size={44}
                    radius="md"
                    variant="light"
                    color={r.isSuperAdmin ? "yellow" : "steel"}
                  >
                    {r.isSuperAdmin ? (
                      <IconCrown size={24} />
                    ) : (
                      <IconShieldHalf size={24} />
                    )}
                  </ThemeIcon>
                  <div>
                    <Text fw={700}>{pickName(r, lang)}</Text>
                    <Text size="xs" c="dimmed">
                      {t("roles.usersCount", { n: r._count?.users ?? 0 })}
                    </Text>
                  </div>
                </Group>

                {(can("roles", "update") || can("roles", "delete")) && (
                  <Menu position="bottom-end" shadow="md">
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray">
                        <IconDots size={18} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {can("roles", "update") && (
                        <Menu.Item
                          leftSection={<IconPencil size={16} />}
                          onClick={() => openEdit(r)}
                        >
                          {t("common.edit")}
                        </Menu.Item>
                      )}
                      {can("roles", "delete") && (
                        <Menu.Item
                          color="red"
                          leftSection={<IconTrash size={16} />}
                          onClick={() => confirmDelete(r)}
                        >
                          {t("common.delete")}
                        </Menu.Item>
                      )}
                    </Menu.Dropdown>
                  </Menu>
                )}
              </Group>

              {r.isSuperAdmin ? (
                <Badge variant="gradient" gradient={{ from: "yellow", to: "orange" }}>
                  {t("roles.fullAccess")}
                </Badge>
              ) : (
                sectionBadges(r)
              )}
            </Card>
            </motion.div>
          ))}
        </SimpleGrid>
      )}

      <RoleFormModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        initial={editing}
      />
    </Page>
  );
}
