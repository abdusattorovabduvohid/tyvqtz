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
  NumberInput,
  Stack,
  Badge,
  ThemeIcon,
  Divider,
  Box,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconDots,
  IconPencil,
  IconTrash,
  IconClock,
} from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/client";
import { Page, PageHeader } from "@/components/Page";
import { useCan } from "@/components/UserContext";
import { useI18n } from "@/components/I18nProvider";
import { pickName } from "@/lib/i18n/translations";

interface Work {
  id: string;
  number: number;
  nameRu: string | null;
  nameUz: string;
  hours: number;
  seh: string | null;
  workerCount: number | null;
  dayFrom: number | null;
  dayTo: number | null;
}
interface Stage {
  id: string;
  number: number;
  nameRu: string;
  nameUz: string | null;
  durationSeconds: number;
  workerCount: number | null;
  note: string | null;
  works: Work[];
}

// строка работы в редакторе — до отправки на сервер
type WorkRow = {
  nameUz: string;
  nameRu: string;
  hours: number | "";
  seh: string;
  workerCount: number | "";
  dayFrom: number | "";
  dayTo: number | "";
};

const MotionTr = motion.create("tr");
const emptyRow = (): WorkRow => ({
  nameUz: "",
  nameRu: "",
  hours: "",
  seh: "",
  workerCount: "",
  dayFrom: 1,
  dayTo: 1,
});
// секунды позиции → рабочие дни (8 ч = 1 день), как в stageWorkdays: округляем ВВЕРХ
const durToDays = (sec: number) => Math.max(1, Math.ceil(sec / 3600 / 8));
// уникальные цехи позиции (из её работ), для колонки списка
const sehList = (works: { seh: string | null }[]) =>
  Array.from(new Set(works.map((w) => w.seh).filter((x): x is string => !!x)));

export default function StagesPage() {
  const can = useCan();
  const { t, lang } = useI18n();
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Stage | null>(null);
  const [saving, setSaving] = useState(false);

  const [number, setNumber] = useState<number | "">("");
  const [nameRu, setNameRu] = useState("");
  const [nameUz, setNameUz] = useState("");
  const [works, setWorks] = useState<WorkRow[]>([emptyRow()]);

  // Срок позиции не вводят руками: как в бумаге, он равен последнему дню её
  // работ (колонка «День»). Часы показываем справочно — они у бригад
  // параллельные, поэтому в сумме дают больше, чем дней × 8.
  const editHours = works.reduce((a, w) => a + (Number(w.hours) || 0), 0);
  const editDays = works.reduce(
    (m, w) => Math.max(m, Number(w.dayTo) || Number(w.dayFrom) || 1),
    1
  );

  async function load() {
    setLoading(true);
    try {
      const r = await apiFetch<{ stages: Stage[] }>("/api/stages");
      setStages(r.stages);
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
    setNumber(stages.length ? Math.max(...stages.map((s) => s.number)) + 1 : 1);
    setNameRu("");
    setNameUz("");
    setWorks([emptyRow()]);
    setModalOpen(true);
  }

  function openEdit(s: Stage) {
    setEditing(s);
    setNumber(s.number);
    setNameRu(s.nameRu);
    setNameUz(s.nameUz ?? "");
    setWorks(
      s.works.length
        ? s.works.map((w) => ({
            nameUz: w.nameUz,
            nameRu: w.nameRu ?? "",
            hours: w.hours,
            seh: w.seh ?? "",
            workerCount: w.workerCount ?? "",
            dayFrom: w.dayFrom ?? 1,
            dayTo: w.dayTo ?? w.dayFrom ?? 1,
          }))
        : [emptyRow()]
    );
    setModalOpen(true);
  }

  function setWork(i: number, patch: Partial<WorkRow>) {
    setWorks((prev) => prev.map((w, j) => (j === i ? { ...w, ...patch } : w)));
  }

  async function save() {
    if (number === "" || Number(number) < 1) {
      notifications.show({ color: "red", message: t("stages.enterNumber") });
      return;
    }
    if (nameUz.trim().length < 1) {
      notifications.show({ color: "red", message: t("stages.enterName") });
      return;
    }
    const clean = works.filter((w) => w.nameUz.trim() || w.hours !== "");
    if (clean.length === 0) {
      notifications.show({ color: "red", message: t("stages.addWork") });
      return;
    }
    if (clean.some((w) => !w.nameUz.trim())) {
      notifications.show({ color: "red", message: t("stages.workNoName") });
      return;
    }
    if (clean.some((w) => !w.hours || Number(w.hours) <= 0)) {
      notifications.show({ color: "red", message: t("stages.workNoHours") });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        number: Number(number),
        nameUz: nameUz.trim(),
        nameRu: nameRu.trim() || null,
        works: clean.map((w) => {
          const from = Number(w.dayFrom) || 1;
          const to = Math.max(from, Number(w.dayTo) || from);
          return {
            nameUz: w.nameUz.trim(),
            nameRu: w.nameRu.trim() || null,
            hours: Number(w.hours),
            seh: w.seh.trim() || null,
            workerCount: w.workerCount === "" ? null : Number(w.workerCount),
            dayFrom: from,
            dayTo: to,
          };
        }),
      };
      if (editing) {
        await apiFetch(`/api/stages/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        notifications.show({ color: "teal", message: t("stages.updated") });
      } else {
        await apiFetch("/api/stages", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        notifications.show({ color: "teal", message: t("stages.created") });
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      notifications.show({ color: "red", message: e.message });
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(s: Stage) {
    modals.openConfirmModal({
      title: t("stages.deleteTitle"),
      children: (
        <Text size="sm">
          {t("stages.deleteBody", { number: s.number, name: pickName(s, lang) })}
        </Text>
      ),
      labels: { confirm: t("common.delete"), cancel: t("common.cancel") },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await apiFetch(`/api/stages/${s.id}`, { method: "DELETE" });
          notifications.show({ color: "teal", message: t("stages.deleted") });
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
        title={t("stages.title")}
        subtitle={t("stages.subtitle")}
        action={
          can("stages", "create") && (
            <Button leftSection={<IconPlus size={18} />} onClick={openCreate}>
              {t("stages.create")}
            </Button>
          )
        }
      />

      <Card p={0}>
        {loading ? (
          <Center py={60}>
            <Loader />
          </Center>
        ) : stages.length === 0 ? (
          <Center py={60}>
            <Text c="dimmed">{t("stages.empty")}</Text>
          </Center>
        ) : (
          <Table.ScrollContainer minWidth={760}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={70}>{t("stages.col.num")}</Table.Th>
                  <Table.Th>{t("stages.col.name")}</Table.Th>
                  <Table.Th w={90}>{t("stages.col.days")}</Table.Th>
                  <Table.Th w={160}>{t("stages.col.seh")}</Table.Th>
                  <Table.Th w={50}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                <AnimatePresence>
                  {stages.map((s, i) => (
                    <MotionTr
                      key={s.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.02 }}
                    >
                      <Table.Td>
                        <ThemeIcon variant="light" color="steel" radius="xl">
                          {s.number}
                        </ThemeIcon>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={600} size="sm">
                          {pickName(s, lang)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t("stages.worksCount", { n: s.works.length })}
                          {/* людей на позиции — сумма по работам */}
                          {(() => {
                            const n = s.works.reduce((a, w) => a + (w.workerCount ?? 0), 0);
                            return n ? ` · ${t("wd.workers", { n })}` : "";
                          })()}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          variant="light"
                          color="grape"
                          leftSection={<IconClock size={13} />}
                        >
                          {t("stages.daysValue", { n: durToDays(s.durationSeconds) })}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          {sehList(s.works).length ? (
                            sehList(s.works).map((sh) => (
                              <Badge key={sh} size="xs" variant="light" color="steel">
                                {t("wd.sehShort", { n: sh })}
                              </Badge>
                            ))
                          ) : (
                            <Text size="sm" c="dimmed">
                              —
                            </Text>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        {(can("stages", "update") || can("stages", "delete")) && (
                          <Menu position="bottom-end" shadow="md">
                            <Menu.Target>
                              <ActionIcon variant="subtle" color="gray">
                                <IconDots size={18} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              {can("stages", "update") && (
                                <Menu.Item
                                  leftSection={<IconPencil size={16} />}
                                  onClick={() => openEdit(s)}
                                >
                                  {t("common.edit")}
                                </Menu.Item>
                              )}
                              {can("stages", "delete") && (
                                <Menu.Item
                                  color="red"
                                  leftSection={<IconTrash size={16} />}
                                  onClick={() => confirmDelete(s)}
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
        title={editing ? t("stages.modalEdit") : t("stages.modalNew")}
        size="xl"
      >
        <Stack>
          {/* № позиции. Срок считается сам из суммы часов работ. */}
          <NumberInput
            label={t("stages.number")}
            withAsterisk
            min={1}
            value={number}
            onChange={(v) => setNumber(typeof v === "number" ? v : "")}
          />

          <TextInput
            label={`${t("stages.name")} (${t("field.uz")})`}
            placeholder="Masalan: Salon poli o‘rnatish"
            withAsterisk
            value={nameUz}
            onChange={(e) => setNameUz(e.currentTarget.value)}
          />
          <TextInput
            label={`${t("stages.name")} (${t("field.ru")})`}
            placeholder={t("stages.namePlaceholder")}
            value={nameRu}
            onChange={(e) => setNameRu(e.currentTarget.value)}
          />

          <Divider label={t("stages.works")} labelPosition="left" />
          <Text size="xs" c="dimmed" mt={-8}>
            {t("stages.worksHint")}
          </Text>

          {/* каждая работа — блок, поля переносятся на телефоне */}
          <Stack gap={10}>
            {works.map((w, i) => (
              <Box
                key={i}
                p="sm"
                style={{
                  borderRadius: 10,
                  border: "1px solid var(--mantine-color-gray-2)",
                  background: "var(--mantine-color-gray-0)",
                }}
              >
                <Group justify="space-between" mb={6}>
                  <Text size="xs" fw={700} c="dimmed">
                    {t("stages.workNo", { n: i + 1 })}
                  </Text>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    size="sm"
                    disabled={works.length === 1}
                    onClick={() => setWorks((p) => p.filter((_, j) => j !== i))}
                    aria-label={t("common.delete")}
                  >
                    <IconTrash size={15} />
                  </ActionIcon>
                </Group>
                <Stack gap={7}>
                  <TextInput
                    placeholder={t("stages.workName") + " (" + t("field.uz") + ")"}
                    value={w.nameUz}
                    onChange={(e) => setWork(i, { nameUz: e.currentTarget.value })}
                  />
                  <TextInput
                    placeholder={t("stages.workName") + " (" + t("field.ru") + ")"}
                    value={w.nameRu}
                    onChange={(e) => setWork(i, { nameRu: e.currentTarget.value })}
                  />
                  <Group grow wrap="wrap">
                    <NumberInput
                      label={t("stages.hours")}
                      min={0}
                      step={0.5}
                      decimalScale={2}
                      value={w.hours}
                      onChange={(v) => setWork(i, { hours: typeof v === "number" ? v : "" })}
                    />
                    <NumberInput
                      label={t("stages.workers")}
                      placeholder="4"
                      min={1}
                      value={w.workerCount}
                      onChange={(v) => setWork(i, { workerCount: typeof v === "number" ? v : "" })}
                    />
                    <TextInput
                      label={t("stages.seh")}
                      placeholder="2"
                      value={w.seh}
                      onChange={(e) => setWork(i, { seh: e.currentTarget.value })}
                    />
                  </Group>
                  {/* Колонка «День» из бумаги: с какого по какой день позиции
                      идёт работа. Одна работа за день → оба поля одинаковые. */}
                  <Group grow wrap="wrap">
                    <NumberInput
                      label={t("stages.dayFrom")}
                      min={1}
                      max={31}
                      value={w.dayFrom}
                      onChange={(v) =>
                        setWork(i, {
                          dayFrom: typeof v === "number" ? v : "",
                          // «по» тянется за «с», если было равно ему или пусто
                          dayTo:
                            typeof v === "number" &&
                            (w.dayTo === "" || Number(w.dayTo) < v)
                              ? v
                              : w.dayTo,
                        })
                      }
                    />
                    <NumberInput
                      label={t("stages.dayTo")}
                      min={Number(w.dayFrom) || 1}
                      max={31}
                      value={w.dayTo}
                      onChange={(v) => setWork(i, { dayTo: typeof v === "number" ? v : "" })}
                    />
                  </Group>
                </Stack>
              </Box>
            ))}
          </Stack>

          <Group justify="space-between" wrap="wrap" gap="sm">
            <Button
              variant="light"
              size="compact-sm"
              leftSection={<IconPlus size={14} />}
              onClick={() => setWorks((p) => [...p, emptyRow()])}
            >
              {t("stages.addWorkBtn")}
            </Button>

            {/* срок позиции считается сам: сумма часов работ, 8 ч = 1 день */}
            <Box
              px="md"
              py={7}
              style={{
                borderRadius: 8,
                background: "var(--mantine-color-grape-0)",
              }}
            >
              <Text size="sm" fw={700} c="grape.8">
                {t("stages.hoursTotal", { h: editHours })} · {t("stages.daysValue", { n: editDays })}
              </Text>
            </Box>
          </Group>

          <Group justify="flex-end" mt="xs">
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
