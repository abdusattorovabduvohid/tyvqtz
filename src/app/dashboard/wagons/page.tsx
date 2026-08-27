"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  Button,
  Card,
  SimpleGrid,
  Text,
  Center,
  Loader,
  Stack,
  ThemeIcon,
  SegmentedControl,
  Box,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconBox } from "@tabler/icons-react";
import { apiFetch, showError } from "@/lib/client";
import { Page, PageHeader } from "@/components/Page";
import { useCan } from "@/components/UserContext";
import { useI18n } from "@/components/I18nProvider";
import { pickName } from "@/lib/i18n/translations";
import { WagonCard, type WagonListItem as Wagon } from "@/components/WagonCard";

// Форма создания — отдельным чанком. Список вагонов открывают с телефона
// каждый день, а создают их редко и не все: незачем возить эту форму в
// бандле страницы. Грузится при первом нажатии «Создать вагон».
const WagonCreateModal = dynamic(
  () => import("@/components/WagonCreateModal").then((m) => m.WagonCreateModal),
  { ssr: false }
);

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
  // после первого открытия форму держим смонтированной — иначе при закрытии
  // она пропадала бы мгновенно, без анимации
  const [modalUsed, setModalUsed] = useState(false);

  const load = useCallback(async () => {
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
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    load();
  }, [load]);

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
        } catch (e) {
          showError(e);
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
            <Button
              leftSection={<IconPlus size={18} />}
              onClick={() => {
                setModalUsed(true);
                setModalOpen(true);
              }}
            >
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

      {modalUsed && (
        <WagonCreateModal
          opened={modalOpen}
          onClose={() => setModalOpen(false)}
          onCreated={load}
          types={types}
        />
      )}
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
