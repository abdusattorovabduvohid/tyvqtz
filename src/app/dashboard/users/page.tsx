"use client";

import { useCallback, useEffect, useState } from "react";
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
  CopyButton,
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
  IconBrandTelegram,
  IconDeviceMobile,
  IconEye,
  IconEyeOff,
  IconCopy,
  IconCheck,
} from "@tabler/icons-react";
import { apiFetch, showError } from "@/lib/client";
import { Page, PageHeader } from "@/components/Page";
import { useCan, useUser } from "@/components/UserContext";
import { useI18n } from "@/components/I18nProvider";
import { pickName } from "@/lib/i18n/translations";
import { revealDelay } from "@/lib/anim";
import { NOTIFICATIONS_ENABLED } from "@/lib/features";
import { UserFormModal, type UserRow } from "@/components/UserFormModal";


// С колонкой уведомлений строка не помещается в телефон: пусть таблица
// скроллится вбок, а не давит текст в столбик.
const BASE_TABLE_WIDTH = NOTIFICATIONS_ENABLED ? 840 : 680;

export default function UsersPage() {
  const can = useCan();
  const me = useUser();
  const { t, lang } = useI18n();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  // Пароли открыты по умолчанию — ради этого колонку и завели. Кнопка-глаз
  // нужна на минуту, когда к столу подошли: прятать по одному бессмысленно.
  const [showPasswords, setShowPasswords] = useState(true);

  const load = useCallback(async () => {
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
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    load();
  }, [load]);

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
        } catch (e) {
          showError(e);
        }
      },
    });
  }

  // Считаем по активным: отключённому сотруднику телеграм и не нужен.
  const noTelegram = users.filter(
    (u) => u.isActive && !u.telegramLinked
  ).length;

  const filtered = users.filter((u) =>
    [u.firstName, u.lastName, u.middleName, u.login, u.role.nameRu, u.role.nameUz]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  // Открытый пароль сервер отдаёт только супер-админу, остальным колонку
  // нечем заполнять — её и не рисуем.
  const canSeePasswords = me.role.isSuperAdmin;
  const tableMinWidth = BASE_TABLE_WIDTH + (canSeePasswords ? 150 : 0);

  // Люди, заведённые до появления открытого пароля: в базе только хеш,
  // вытащить из него исходный пароль нельзя — придётся задать новый.
  const noPassword = canSeePasswords
    ? users.filter((u) => u.isActive && !u.passwordPlain).length
    : 0;

  // Копируется ровно то, что на экране: сузили поиском — уйдёт часть списка.
  const listText = filtered
    .map(
      (u, i) =>
        `${i + 1}. ${u.lastName} ${u.firstName} — ${u.login} / ${
          u.passwordPlain || t("users.pwUnknown")
        }`
    )
    .join("\n");

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
          <Group gap="sm">
            {NOTIFICATIONS_ENABLED && noTelegram > 0 && (
              <Badge variant="light" color="red">
                {t("users.tgMissing", { n: noTelegram })}
              </Badge>
            )}
            {noPassword > 0 && (
              <Badge variant="light" color="orange">
                {t("users.pwMissing", { n: noPassword })}
              </Badge>
            )}
            {canSeePasswords && (
              <>
                <Tooltip
                  label={showPasswords ? t("users.pwHide") : t("users.pwShow")}
                >
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    onClick={() => setShowPasswords((v) => !v)}
                    aria-label={
                      showPasswords ? t("users.pwHide") : t("users.pwShow")
                    }
                  >
                    {showPasswords ? (
                      <IconEyeOff size={18} />
                    ) : (
                      <IconEye size={18} />
                    )}
                  </ActionIcon>
                </Tooltip>
                <CopyButton value={listText}>
                  {({ copied, copy }) => (
                    <Tooltip label={t("users.copyHint")} multiline w={260}>
                      <Button
                        variant="light"
                        size="compact-sm"
                        color={copied ? "teal" : undefined}
                        leftSection={
                          copied ? (
                            <IconCheck size={16} />
                          ) : (
                            <IconCopy size={16} />
                          )
                        }
                        onClick={copy}
                        disabled={filtered.length === 0}
                      >
                        {copied ? t("common.copied") : t("users.copyList")}
                      </Button>
                    </Tooltip>
                  )}
                </CopyButton>
              </>
            )}
            <Text size="sm" c="dimmed">
              {t("common.total")}: {filtered.length}
            </Text>
          </Group>
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
          <Table.ScrollContainer minWidth={tableMinWidth}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("users.col.user")}</Table.Th>
                  <Table.Th>{t("users.col.login")}</Table.Th>
                  {canSeePasswords && (
                    <Table.Th>{t("users.col.password")}</Table.Th>
                  )}
                  <Table.Th>{t("users.col.role")}</Table.Th>
                  {NOTIFICATIONS_ENABLED && (
                    <Table.Th>{t("users.col.notify")}</Table.Th>
                  )}
                  <Table.Th>{t("users.col.status")}</Table.Th>
                  <Table.Th w={60}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((u, i) => (
                  <Table.Tr
                    key={u.id}
                    className="reveal-up"
                    style={{ animationDelay: revealDelay(i) }}
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
                          <Group gap={6} wrap="nowrap">
                            <Text fw={600} size="sm">
                              {u.lastName} {u.firstName}
                            </Text>
                            {u.seh && (
                              <Badge size="xs" variant="light" color="steel">
                                {t("wd.sehShort", { n: u.seh })}
                              </Badge>
                            )}
                          </Group>
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
                    {/* Пароль рядом с логином: раньше его приходилось
                        открывать в карточке каждого человека по очереди. */}
                    {canSeePasswords && (
                      <Table.Td>
                        {u.passwordPlain ? (
                          <Text size="sm" ff="monospace">
                            {showPasswords ? u.passwordPlain : "••••••"}
                          </Text>
                        ) : (
                          <Text size="sm" c="dimmed">
                            {t("users.pwUnknown")}
                          </Text>
                        )}
                      </Table.Td>
                    )}
                    <Table.Td>
                      <Badge variant="light" color="blue">
                        {pickName(u.role, lang)}
                      </Badge>
                    </Table.Td>
                    {/* Кто подключил телеграм. Нужно на разборах: сотрудник
                        говорит «мне не сообщили», а видно, что он сам не
                        подключился — уведомлению просто некуда было прийти. */}
                    {NOTIFICATIONS_ENABLED && (
                      <Table.Td>
                        <Group gap={6} wrap="nowrap">
                          {u.telegramLinked ? (
                            <Badge
                              variant="light"
                              color="teal"
                              leftSection={<IconBrandTelegram size={12} />}
                            >
                              {u.telegramUsername
                                ? `@${u.telegramUsername}`
                                : t("users.tgOn")}
                            </Badge>
                          ) : (
                            <Badge variant="light" color="red">
                              {t("users.tgOff")}
                            </Badge>
                          )}
                          {(u.pushDevices ?? 0) > 0 && (
                            <Badge
                              variant="light"
                              color="gray"
                              leftSection={<IconDeviceMobile size={12} />}
                            >
                              {u.pushDevices}
                            </Badge>
                          )}
                        </Group>
                      </Table.Td>
                    )}
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
                  </Table.Tr>
                ))}
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
