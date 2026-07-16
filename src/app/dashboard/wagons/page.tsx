"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Button,
  Card,
  SimpleGrid,
  Group,
  Text,
  Center,
  Loader,
  Modal,
  TextInput,
  Select,
  MultiSelect,
  Stack,
  ThemeIcon,
  SegmentedControl,
  Box,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconBox } from "@tabler/icons-react";
import { apiFetch } from "@/lib/client";
import { Page, PageHeader } from "@/components/Page";
import { useCan } from "@/components/UserContext";
import { useI18n } from "@/components/I18nProvider";
import { pickName } from "@/lib/i18n/translations";
import { OrderedUserPicker } from "@/components/OrderedUserPicker";
import { WagonCard, type WagonListItem as Wagon } from "@/components/WagonCard";

function WagonsContent() {
  const can = useCan();
  const { t, lang } = useI18n();
  const params = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>(
    params.get("status") || "all"
  );
  const [wagons, setWagons] = useState<Wagon[]>([]);
  const [types, setTypes] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameRu, setNameRu] = useState("");
  const [nameUz, setNameUz] = useState("");
  const [number, setNumber] = useState("");
  const [typeId, setTypeId] = useState<string | null>(null);
  const [allStages, setAllStages] = useState<
    { value: string; label: string }[]
  >([]);
  const [stageIds, setStageIds] = useState<string[]>([]);
  const [userOptions, setUserOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [responsibleIds, setResponsibleIds] = useState<string[]>([]);
  const [executorIds, setExecutorIds] = useState<string[]>([]);
  const [creationApproverIds, setCreationApproverIds] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    try {
      const [w, tps] = await Promise.all([
        apiFetch<{ wagons: Wagon[] }>("/api/wagons"),
        apiFetch<{ types: { id: string; nameRu: string; nameUz: string | null }[] }>(
          "/api/options/wagon-types"
        ),
      ]);
      setWagons(w.wagons);
      setTypes(
        tps.types.map((x) => ({ value: x.id, label: pickName(x, lang) }))
      );
    } catch (e: any) {
      notifications.show({ color: "red", message: e.message });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  // Кнопки жмут только ответственные: сняли из ответственных — снимаем и отсюда.
  useEffect(() => {
    setExecutorIds((prev) => prev.filter((id) => responsibleIds.includes(id)));
  }, [responsibleIds]);

  const executorOptions = responsibleIds.flatMap((id) => {
    const opt = userOptions.find((o) => o.value === id);
    return opt ? [opt] : [];
  });

  async function openCreate() {
    setNameRu("");
    setNameUz("");
    setNumber("");
    setTypeId(null);
    setResponsibleIds([]);
    setExecutorIds([]);
    setCreationApproverIds([]);
    setModalOpen(true);
    try {
      const [st, us] = await Promise.all([
        apiFetch<{
          stages: { id: string; number: number; nameRu: string; nameUz: string | null }[];
        }>("/api/stages"),
        apiFetch<{
          users: { id: string; firstName: string; lastName: string; middleName: string | null }[];
        }>("/api/options/users"),
      ]);
      const opts = st.stages.map((s) => ({
        value: s.id,
        label: `№${s.number} — ${pickName(s, lang)}`,
      }));
      setAllStages(opts);
      setStageIds(opts.map((o) => o.value)); // по умолчанию все выбраны
      setUserOptions(
        us.users.map((u) => ({
          value: u.id,
          label: [u.lastName, u.firstName, u.middleName].filter(Boolean).join(" "),
        }))
      );
    } catch (e: any) {
      notifications.show({ color: "red", message: e.message });
    }
  }

  async function save() {
    if (!nameUz.trim() || !number.trim() || !typeId) {
      notifications.show({ color: "red", message: t("wagons.fillAll") });
      return;
    }
    if (stageIds.length === 0) {
      notifications.show({ color: "red", message: t("wagons.pickStage") });
      return;
    }
    if (responsibleIds.length === 0) {
      notifications.show({ color: "red", message: t("wagons.pickUsers") });
      return;
    }
    if (executorIds.length === 0) {
      notifications.show({ color: "red", message: t("wagons.pickExecutors") });
      return;
    }
    if (creationApproverIds.length === 0) {
      notifications.show({ color: "red", message: t("wagons.pickApprovers") });
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/wagons", {
        method: "POST",
        body: JSON.stringify({
          nameUz: nameUz.trim(),
          nameRu: nameRu.trim() || null,
          number: number.trim(),
          wagonTypeId: typeId,
          stageIds,
          userIds: responsibleIds,
          executorIds,
          creationApproverIds,
        }),
      });
      notifications.show({
        color: "teal",
        message: t("wagons.created", { n: stageIds.length }),
      });
      setModalOpen(false);
      load();
    } catch (e: any) {
      notifications.show({ color: "red", title: "Ошибка", message: e.message });
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(w: Wagon) {
    modals.openConfirmModal({
      title: t("wagons.deleteTitle"),
      children: (
        <Text size="sm">
          {t("wagons.deleteBody", { name: pickName(w, lang), number: w.number })}
        </Text>
      ),
      labels: { confirm: t("common.delete"), cancel: t("common.cancel") },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await apiFetch(`/api/wagons/${w.id}`, { method: "DELETE" });
          notifications.show({ color: "teal", message: t("wagons.deleted") });
          load();
        } catch (e: any) {
          notifications.show({ color: "red", message: e.message });
        }
      },
    });
  }

  const counts = wagons.reduce(
    (acc, w) => {
      acc[w.status] = (acc[w.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const filtered =
    statusFilter === "all"
      ? wagons
      : wagons.filter((w) => w.status === statusFilter);
  const segData = [
    { value: "all", label: `${t("wagons.filterAll")} (${wagons.length})` },
    { value: "pending", label: `${t("wstatus.pending")} (${counts.pending || 0})` },
    {
      value: "in_progress",
      label: `${t("wstatus.in_progress")} (${counts.in_progress || 0})`,
    },
    { value: "done", label: `${t("wstatus.done")} (${counts.done || 0})` },
    { value: "blocked", label: `${t("wstatus.blocked")} (${counts.blocked || 0})` },
  ];

  return (
    <Page>
      <PageHeader
        title={t("wagons.title")}
        subtitle={t("wagons.subtitle")}
        action={
          can("wagons", "create") && (
            <Button leftSection={<IconPlus size={18} />} onClick={openCreate}>
              {t("wagons.create")}
            </Button>
          )
        }
      />

      {!loading && wagons.length > 0 && (
        <Box style={{ overflowX: "auto" }} mb="lg">
          <SegmentedControl
            value={statusFilter}
            onChange={setStatusFilter}
            data={segData}
          />
        </Box>
      )}

      {loading ? (
        <Center py={60}>
          <Loader />
        </Center>
      ) : wagons.length === 0 ? (
        <Card>
          <Center py={60}>
            <Stack align="center">
              <ThemeIcon size={60} radius="xl" variant="light" color="steel">
                <IconBox size={32} />
              </ThemeIcon>
              <Text c="dimmed">{t("wagons.empty")}</Text>
            </Stack>
          </Center>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <Center py={60}>
            <Text c="dimmed">{t("wagons.empty")}</Text>
          </Center>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
          {filtered.map((w, i) => (
            <WagonCard
              key={w.id}
              w={w}
              index={i}
              canDelete={can("wagons", "delete")}
              onDelete={confirmDelete}
            />
          ))}
        </SimpleGrid>
      )}

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t("wagons.modalNew")}
      >
        <Stack>
          <TextInput
            label={`${t("wagons.name")} (${t("field.uz")})`}
            placeholder="Masalan: Xopper-don tashuvchi"
            withAsterisk
            value={nameUz}
            onChange={(e) => setNameUz(e.currentTarget.value)}
          />
          <TextInput
            label={`${t("wagons.name")} (${t("field.ru")})`}
            placeholder={t("wagons.namePlaceholder")}
            value={nameRu}
            onChange={(e) => setNameRu(e.currentTarget.value)}
          />
          <TextInput
            label={t("wagons.number")}
            placeholder={t("wagons.numberPlaceholder")}
            withAsterisk
            value={number}
            onChange={(e) => setNumber(e.currentTarget.value)}
          />
          <Select
            label={t("wagons.type")}
            placeholder={
              types.length
                ? t("wagons.typePlaceholder")
                : t("wagons.typePlaceholderEmpty")
            }
            withAsterisk
            data={types}
            value={typeId}
            onChange={setTypeId}
            searchable
            nothingFoundMessage={t("wagons.noTypes")}
          />
          <MultiSelect
            label={t("wagons.stagesSelect", { n: stageIds.length })}
            placeholder={
              allStages.length
                ? t("wagons.stagesSelectPlaceholder")
                : t("wagons.stagesSelectEmpty")
            }
            data={allStages}
            value={stageIds}
            onChange={setStageIds}
            searchable
            clearable
            hidePickedOptions
            maxDropdownHeight={240}
          />
          <Text size="xs" c="dimmed">
            {t("wagons.stagesHint")}
          </Text>
          <div>
            <Text size="sm" fw={500} mb={4}>
              {t("wagons.creationApprovers")}{" "}
              <Text span c="red">
                *
              </Text>
            </Text>
            <OrderedUserPicker
              options={userOptions}
              value={creationApproverIds}
              onChange={setCreationApproverIds}
            />
          </div>
          <Text size="xs" c="dimmed">
            {t("wagons.creationApproversHint")}
          </Text>
          <div>
            <Text size="sm" fw={500} mb={4}>
              {t("wagons.responsible")}{" "}
              <Text span c="red">
                *
              </Text>
            </Text>
            <OrderedUserPicker
              options={userOptions}
              value={responsibleIds}
              onChange={setResponsibleIds}
            />
          </div>
          <Text size="xs" c="dimmed">
            {t("wagons.responsibleHint")}
          </Text>
          <MultiSelect
            label={t("wagons.executors")}
            placeholder={
              responsibleIds.length
                ? t("wagons.executorsPlaceholder")
                : t("wagons.executorsEmpty")
            }
            withAsterisk
            data={executorOptions}
            value={executorIds}
            onChange={setExecutorIds}
            disabled={responsibleIds.length === 0}
            searchable
            clearable
            hidePickedOptions
            maxDropdownHeight={240}
          />
          <Text size="xs" c="dimmed">
            {t("wagons.executorsHint")}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={save} loading={saving}>
              {t("common.create")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Page>
  );
}

export default function WagonsPage() {
  return (
    <Suspense fallback={null}>
      <WagonsContent />
    </Suspense>
  );
}
