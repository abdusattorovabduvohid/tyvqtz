"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Table,
  Group,
  Text,
  ActionIcon,
  Menu,
  Center,
  Loader,
  Modal,
  TextInput,
  Stack,
  Badge,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconDots,
  IconPencil,
  IconTrash,
  IconTrain,
} from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/client";
import { Page, PageHeader } from "@/components/Page";
import { useCan } from "@/components/UserContext";
import { useI18n } from "@/components/I18nProvider";
import { pickName } from "@/lib/i18n/translations";

interface WagonType {
  id: string;
  nameRu: string;
  nameUz: string | null;
  _count?: { wagons: number };
}

const MotionTr = motion.create("tr");

export default function WagonTypesPage() {
  const can = useCan();
  const { t, lang } = useI18n();
  const [types, setTypes] = useState<WagonType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WagonType | null>(null);
  const [nameRu, setNameRu] = useState("");
  const [nameUz, setNameUz] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await apiFetch<{ types: WagonType[] }>("/api/wagon-types");
      setTypes(r.types);
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
    setNameRu("");
    setNameUz("");
    setModalOpen(true);
  }
  function openEdit(wt: WagonType) {
    setEditing(wt);
    setNameRu(wt.nameRu);
    setNameUz(wt.nameUz ?? "");
    setModalOpen(true);
  }

  async function save() {
    if (nameUz.trim().length < 1) {
      notifications.show({ color: "red", message: t("wtypes.enterName") });
      return;
    }
    const payload = { nameUz: nameUz.trim(), nameRu: nameRu.trim() || null };
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/api/wagon-types/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        notifications.show({ color: "teal", message: t("wtypes.updated") });
      } else {
        await apiFetch("/api/wagon-types", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        notifications.show({ color: "teal", message: t("wtypes.created") });
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      notifications.show({ color: "red", message: e.message });
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(wt: WagonType) {
    modals.openConfirmModal({
      title: t("wtypes.deleteTitle"),
      children: (
        <Text size="sm">{t("wtypes.deleteBody", { name: pickName(wt, lang) })}</Text>
      ),
      labels: { confirm: t("common.delete"), cancel: t("common.cancel") },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await apiFetch(`/api/wagon-types/${wt.id}`, { method: "DELETE" });
          notifications.show({ color: "teal", message: t("wtypes.deleted") });
          load();
        } catch (e: any) {
          notifications.show({ color: "red", message: e.message });
        }
      },
    });
  }

  return (
    <Page>
      <PageHeader
        title={t("wtypes.title")}
        subtitle={t("wtypes.subtitle")}
        action={
          can("wagon-types", "create") && (
            <Button leftSection={<IconPlus size={18} />} onClick={openCreate}>
              {t("wtypes.create")}
            </Button>
          )
        }
      />

      <Card p={0}>
        {loading ? (
          <Center py={60}>
            <Loader />
          </Center>
        ) : types.length === 0 ? (
          <Center py={60}>
            <Text c="dimmed">{t("wtypes.empty")}</Text>
          </Center>
        ) : (
          <Table.ScrollContainer minWidth={500}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("wtypes.col.type")}</Table.Th>
                  <Table.Th>{t("wtypes.col.wagons")}</Table.Th>
                  <Table.Th w={60}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                <AnimatePresence>
                  {types.map((wt, i) => (
                    <MotionTr
                      key={wt.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <Table.Td>
                        <Group gap="sm">
                          <IconTrain size={20} color="var(--mantine-color-teal-6)" />
                          <Text fw={600} size="sm">
                            {pickName(wt, lang)}
                          </Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="gray">
                          {wt._count?.wagons ?? 0}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {(can("wagon-types", "update") ||
                          can("wagon-types", "delete")) && (
                          <Menu position="bottom-end" shadow="md">
                            <Menu.Target>
                              <ActionIcon variant="subtle" color="gray">
                                <IconDots size={18} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              {can("wagon-types", "update") && (
                                <Menu.Item
                                  leftSection={<IconPencil size={16} />}
                                  onClick={() => openEdit(wt)}
                                >
                                  {t("common.edit")}
                                </Menu.Item>
                              )}
                              {can("wagon-types", "delete") && (
                                <Menu.Item
                                  color="red"
                                  leftSection={<IconTrash size={16} />}
                                  onClick={() => confirmDelete(wt)}
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

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t("wtypes.modalEdit") : t("wtypes.modalNew")}
      >
        <Stack>
          <TextInput
            label={`${t("wtypes.name")} (${t("field.uz")})`}
            placeholder="Masalan: Yarim vagon"
            withAsterisk
            value={nameUz}
            onChange={(e) => setNameUz(e.currentTarget.value)}
            data-autofocus
          />
          <TextInput
            label={`${t("wtypes.name")} (${t("field.ru")})`}
            placeholder={t("wtypes.namePlaceholder")}
            value={nameRu}
            onChange={(e) => setNameRu(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? t("common.save") : t("common.create")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Page>
  );
}
