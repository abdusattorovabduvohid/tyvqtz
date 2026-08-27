"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  SimpleGrid,
  Group,
  Text,
  ActionIcon,
  Menu,
  Center,
  Loader,
  Modal,
  TextInput,
  Stack,
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
import { apiFetch, showError } from "@/lib/client";
import { Page, PageHeader } from "@/components/Page";
import { useCan } from "@/components/UserContext";
import { useI18n } from "@/components/I18nProvider";
import { pickName, type Lang } from "@/lib/i18n/translations";
import { revealDelay } from "@/lib/anim";

interface WagonType {
  id: string;
  nameRu: string | null;
  nameUz: string;
  _count?: { wagons: number };
}

/** Название на втором языке — мелкой строкой под основным. */
function altName(wt: WagonType, lang: Lang) {
  const alt = (lang === "uz" ? wt.nameRu : wt.nameUz)?.trim() ?? "";
  return alt && alt !== pickName(wt, lang) ? alt : "";
}

/** Плитка со сводным числом наверху страницы. */
function Stat({ value, label, muted }: { value: number; label: string; muted?: boolean }) {
  return (
    <Box
      style={{
        background: "#fff",
        border: "1px solid #e6eaf2",
        borderRadius: 16,
        boxShadow: "0 2px 8px rgba(16,32,64,.06)",
        padding: "14px 16px",
      }}
    >
      {/* clamp — на телефоне три плитки в ряд, число не выдавливает подпись */}
      <Text
        fw={800}
        lh={1}
        c={muted ? "#5b6b8c" : "#0f1e3d"}
        style={{ fontSize: "clamp(22px, 6vw, 30px)", letterSpacing: -0.8 }}
      >
        {value}
      </Text>
      <Text
        mt={6}
        size="11px"
        fw={600}
        c="#8a93a8"
        lh={1.25}
        style={{ letterSpacing: 0.4, textTransform: "uppercase" }}
      >
        {label}
      </Text>
    </Box>
  );
}

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
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  // Считаем один раз на список, а не в каждой карточке при каждом рендере:
  // сортировка, сумма, пустые типы и доли — за один проход.
  const { rows, total, empty } = useMemo(() => {
    let total = 0;
    let empty = 0;
    for (const wt of types) {
      const n = wt._count?.wagons ?? 0;
      total += n;
      if (n === 0) empty++;
    }
    const rows = types
      .map((wt) => ({ wt, n: wt._count?.wagons ?? 0 }))
      .sort((a, b) => b.n - a.n)
      .map((r) => ({
        ...r,
        share: total > 0 ? Math.round((r.n / total) * 100) : 0,
      }));
    return { rows, total, empty };
  }, [types]);

  function openCreate() {
    setEditing(null);
    setNameRu("");
    setNameUz("");
    setModalOpen(true);
  }
  function openEdit(wt: WagonType) {
    setEditing(wt);
    setNameRu(wt.nameRu ?? "");
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
    } catch (e) {
      showError(e);
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
        } catch (e) {
          showError(e);
        }
      },
    });
  }

  const canEdit = can("wagon-types", "update");
  const canDelete = can("wagon-types", "delete");

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

      {loading ? (
        <Card p={0}>
          <Center py={60}>
            <Loader />
          </Center>
        </Card>
      ) : types.length === 0 ? (
        <Card p={0}>
          <Center py={60}>
            <Text c="dimmed">{t("wtypes.empty")}</Text>
          </Center>
        </Card>
      ) : (
        <>
          {/* Сводка: сколько всего типов, вагонов и типов без вагонов */}
          <SimpleGrid cols={3} spacing={{ base: "xs", sm: "md" }} mb="md">
            <Stat value={types.length} label={t("wtypes.stat.types")} />
            <Stat value={total} label={t("wtypes.stat.wagons")} />
            <Stat value={empty} label={t("wtypes.stat.empty")} muted />
          </SimpleGrid>

          {/* На телефоне одна колонка, с планшета — две */}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {rows.map(({ wt, n, share }, i) => (
              <Box
                key={wt.id}
                className="reveal-up"
                style={{
                  animationDelay: revealDelay(i),
                  background: "#fff",
                  border: "1px solid #e6eaf2",
                  borderRadius: 16,
                  boxShadow: "0 2px 8px rgba(16,32,64,.06)",
                  padding: "14px 16px",
                }}
              >
                <Group gap="sm" wrap="nowrap" align="center">
                  <Box
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      display: "grid",
                      placeItems: "center",
                      flex: "none",
                      background: n > 0 ? "#e6fcf5" : "#f1f3f5",
                      color: n > 0 ? "#0ca678" : "#adb5bd",
                    }}
                  >
                    <IconTrain size={20} />
                  </Box>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text fw={700} size="15px" lh={1.3} c="#0f1e3d" lineClamp={1}>
                      {pickName(wt, lang)}
                    </Text>
                    {altName(wt, lang) && (
                      <Text size="12.5px" c="#8a93a8" lh={1.35} lineClamp={1}>
                        {altName(wt, lang)}
                      </Text>
                    )}
                  </div>

                  {(canEdit || canDelete) && (
                    <Menu position="bottom-end" shadow="md">
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray" style={{ flex: "none" }}>
                          <IconDots size={18} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        {canEdit && (
                          <Menu.Item
                            leftSection={<IconPencil size={16} />}
                            onClick={() => openEdit(wt)}
                          >
                            {t("common.edit")}
                          </Menu.Item>
                        )}
                        {canDelete && (
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
                </Group>

                <Group justify="space-between" align="baseline" gap="xs" wrap="nowrap" mt="md">
                  <Text size="14px" fw={700} c={n > 0 ? "#0f1e3d" : "#b0b8c8"}>
                    {n > 0 ? t("wtypes.wagonsN", { n }) : t("wtypes.noWagons")}
                  </Text>
                  <Text size="13px" fw={700} c={n > 0 ? "#2f66c9" : "#b0b8c8"}>
                    {share}%
                  </Text>
                </Group>

                {/* Полоса доли. Ширина задана сразу, «набегание» рисует scaleX
                    (класс .grow-x) — width на каждом кадре пересчитывал бы вёрстку. */}
                <Box
                  mt={8}
                  style={{
                    height: 8,
                    borderRadius: 99,
                    background: "#eef1f7",
                    overflow: "hidden",
                  }}
                >
                  {n > 0 && (
                    <Box
                      className="grow-x"
                      style={{
                        // у редкого типа доля округляется в 0 — полосу всё равно видно
                        width: `${Math.max(share, 3)}%`,
                        height: "100%",
                        borderRadius: 99,
                        background: "linear-gradient(90deg,#2f66c9,#22a7e0)",
                        animationDelay: revealDelay(i),
                      }}
                    />
                  )}
                </Box>
              </Box>
            ))}
          </SimpleGrid>
        </>
      )}

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
