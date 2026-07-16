"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Table,
  Group,
  Avatar,
  Text,
  Badge,
  ActionIcon,
  Menu,
  Center,
  Loader,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconDots,
  IconPencil,
  IconTrash,
  IconSearch,
  IconUserOff,
} from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/client";
import { Page, PageHeader } from "@/components/Page";
import { useCan } from "@/components/UserContext";
import { useI18n } from "@/components/I18nProvider";
import { pickName } from "@/lib/i18n/translations";
import { UserFormModal, type UserRow } from "@/components/UserFormModal";

const MotionTr = motion.create("tr");

export default function UsersPage() {
  const can = useCan();
  const { t, lang } = useI18n();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([
        apiFetch<{ users: UserRow[] }>("/api/users"),
        apiFetch<{ roles: { id: string; nameRu: string; nameUz: string | null }[] }>(
          "/api/options/roles"
        ),
      ]);
      setUsers(u.users);
      setRoles(r.roles.map((x) => ({ value: x.id, label: pickName(x, lang) })));
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
  function openEdit(u: UserRow) {
    setEditing(u);
    setModalOpen(true);
  }

  function confirmDelete(u: UserRow) {
    modals.openConfirmModal({
      title: t("users.deleteTitle"),
      children: (
        <Text size="sm">
          {t("users.deleteBody", { name: `${u.firstName} ${u.lastName}` })}
        </Text>
      ),
      labels: { confirm: t("common.delete"), cancel: t("common.cancel") },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await apiFetch(`/api/users/${u.id}`, { method: "DELETE" });
          notifications.show({ color: "teal", message: t("users.deleted") });
          load();
        } catch (e: any) {
          notifications.show({ color: "red", message: e.message });
        }
      },
    });
  }

  const filtered = users.filter((u) =>
    [u.firstName, u.lastName, u.middleName, u.login, u.role.nameRu, u.role.nameUz]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <Page>
      <PageHeader
        title={t("users.title")}
        subtitle={t("users.subtitle")}
        action={
          can("users", "create") && (
            <Button leftSection={<IconPlus size={18} />} onClick={openCreate}>
              {t("users.create")}
            </Button>
          )
        }
      />

      <Card p={0}>
        <Group p="md" justify="space-between">
          <TextInput
            placeholder={t("common.search")}
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={280}
          />
          <Text size="sm" c="dimmed">
            {t("common.total")}: {filtered.length}
          </Text>
        </Group>

        {loading ? (
          <Center py={60}>
            <Loader />
          </Center>
        ) : filtered.length === 0 ? (
          <Center py={60}>
            <Text c="dimmed">{t("users.empty")}</Text>
          </Center>
        ) : (
          <Table.ScrollContainer minWidth={680}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("users.col.user")}</Table.Th>
                  <Table.Th>{t("users.col.login")}</Table.Th>
                  <Table.Th>{t("users.col.role")}</Table.Th>
                  <Table.Th>{t("users.col.status")}</Table.Th>
                  <Table.Th w={60}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                <AnimatePresence>
                  {filtered.map((u, i) => (
                    <MotionTr
                      key={u.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <Table.Td>
                        <Group gap="sm">
                          <Avatar
                            src={u.photo || undefined}
                            radius="xl"
                            color="steel"
                          >
                            {u.firstName?.[0]}
                            {u.lastName?.[0]}
                          </Avatar>
                          <div>
                            <Text fw={600} size="sm">
                              {u.lastName} {u.firstName}
                            </Text>
                            {u.middleName && (
                              <Text size="xs" c="dimmed">
                                {u.middleName}
                              </Text>
                            )}
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{u.login}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="blue">
                          {pickName(u.role, lang)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {u.isActive ? (
                          <Badge variant="dot" color="teal">
                            {t("users.active")}
                          </Badge>
                        ) : (
                          <Badge variant="dot" color="gray">
                            {t("users.inactive")}
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {(can("users", "update") || can("users", "delete")) && (
                          <Menu position="bottom-end" shadow="md">
                            <Menu.Target>
                              <ActionIcon variant="subtle" color="gray">
                                <IconDots size={18} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              {can("users", "update") && (
                                <Menu.Item
                                  leftSection={<IconPencil size={16} />}
                                  onClick={() => openEdit(u)}
                                >
                                  {t("common.edit")}
                                </Menu.Item>
                              )}
                              {can("users", "delete") && (
                                <Menu.Item
                                  color="red"
                                  leftSection={<IconTrash size={16} />}
                                  onClick={() => confirmDelete(u)}
                                >
                                  {t("common.delete")}
                                </Menu.Item>
                              )}
                            </Menu.Dropdown>
                          </Menu>
                        )}
                      </Table.Td>
                    </MotionTr>
                  ))}
                </AnimatePresence>
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>

      <UserFormModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        roles={roles}
        initial={editing}
      />
    </Page>
  );
}
