"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  ScrollArea,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconDatabase,
  IconDeviceMobile,
  IconLogout,
  IconUsers,
} from "@tabler/icons-react";
import { apiFetch, showError } from "@/lib/client";
import { useI18n } from "@/components/I18nProvider";

type PresenceState = "online" | "idle" | "offline";

interface Person {
  id: string;
  name: string;
  seh: string | null;
  role: string;
  isSuperAdmin: boolean;
  lastSeenAt: string | null;
  state: PresenceState;
}

interface LogRow {
  id: string;
  name: string | null;
  loginTried: string;
  success: boolean;
  reason: string | null;
  ip: string | null;
  device: string | null;
  os: string | null;
  browser: string | null;
  ipCity: string | null;
  ipCountry: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAccuracy: number | null;
  createdAt: string;
}

interface ControlData {
  siteEnabled: boolean;
  lastBackupAt: string | null;
  onlineMin: number;
  counts: { online: number; todayOk: number; todayFail: number };
  people: Person[];
  offlineCount: number;
  logs: LogRow[];
}

// Панель открыта на экране подолгу, поэтому обновляем её сами. 30 секунд —
// заметно быстрее, чем человек успеет усомниться в цифрах, и достаточно
// редко, чтобы не жечь лимиты Supabase.
const REFRESH_MS = 30_000;

type Translate = (key: string, params?: Record<string, string | number>) => string;

function timeAgo(iso: string | null, t: Translate): string {
  if (!iso) return "—";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return t("control.justNow");
  if (min < 60) return t("control.minAgo", { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t("control.hoursAgo", { n: h });
  return new Date(iso).toLocaleString();
}

const STATE_COLOR: Record<PresenceState, string> = {
  online: "green",
  idle: "yellow",
  offline: "gray",
};

function deviceLine(l: Pick<LogRow, "device" | "os" | "browser">): string {
  return [l.device, l.os, l.browser].filter(Boolean).join(" · ") || "—";
}

export function ControlPanel({ meId }: { meId: string }) {
  const { t } = useI18n();
  const [data, setData] = useState<ControlData | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<ControlData>("/api/control"));
    } catch (e) {
      showError(e);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  async function toggleSite(enabled: boolean) {
    setBusy(true);
    try {
      await apiFetch("/api/control/site", {
        method: "POST",
        body: JSON.stringify({ enabled }),
      });
      notifications.show({
        color: enabled ? "teal" : "red",
        message: enabled ? t("control.siteOnDone") : t("control.siteOffDone"),
      });
      await load();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }

  function confirmKick(p: Person) {
    modals.openConfirmModal({
      title: t("control.kickTitle"),
      children: <Text size="sm">{t("control.kickBody", { name: p.name })}</Text>,
      labels: { confirm: t("control.kick"), cancel: t("common.cancel") },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await apiFetch("/api/control/kick", {
            method: "POST",
            body: JSON.stringify({ userId: p.id }),
          });
          notifications.show({ color: "orange", message: t("control.kickDone") });
          await load();
        } catch (e) {
          showError(e);
        }
      },
    });
  }

  // Выключение — необратимое для сотрудников действие, поэтому спрашиваем.
  // Обратное включение подтверждения не требует: оно ничего не ломает.
  function onSwitch(next: boolean) {
    if (next) return toggleSite(true);
    modals.openConfirmModal({
      title: t("control.siteOffTitle"),
      children: <Text size="sm">{t("control.siteOffBody")}</Text>,
      labels: { confirm: t("control.siteOffConfirm"), cancel: t("common.cancel") },
      confirmProps: { color: "red" },
      onConfirm: () => toggleSite(false),
    });
  }

  if (!data) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  const off = !data.siteEnabled;

  return (
    <Stack gap="lg">
      <Title order={3}>{t("control.title")}</Title>

      {/* ── Рубильник ── */}
      <Card
        withBorder
        radius="lg"
        padding="lg"
        style={{
          background: off ? "var(--mantine-color-red-0)" : "var(--mantine-color-green-0)",
          borderColor: off
            ? "var(--mantine-color-red-3)"
            : "var(--mantine-color-green-3)",
        }}
      >
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Box>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: 1 }}>
              {t("control.siteState")}
            </Text>
            <Text fz={22} fw={700} c={off ? "red.7" : "green.7"} mt={2}>
              {off ? t("control.siteOff") : t("control.siteOn")}
            </Text>
          </Box>
          <Switch
            size="xl"
            checked={data.siteEnabled}
            disabled={busy}
            onChange={(e) => onSwitch(e.currentTarget.checked)}
            aria-label={t("control.siteState")}
          />
        </Group>
        <Text size="sm" c="dimmed" mt="sm" lh={1.5}>
          {off ? t("control.siteOffHint") : t("control.siteOnHint")}
        </Text>
      </Card>

      {/* ── Цифры ── */}
      <SimpleGrid cols={{ base: 3 }} spacing="xs">
        <Card withBorder radius="md" padding="sm">
          <Text fz={26} fw={700} c="steel.7" lh={1.1}>
            {data.counts.online}
          </Text>
          <Text size="xs" c="dimmed" lh={1.3} mt={2}>
            {t("control.nowOnline")}
          </Text>
        </Card>
        <Card withBorder radius="md" padding="sm">
          <Text fz={26} fw={700} c="steel.7" lh={1.1}>
            {data.counts.todayOk}
          </Text>
          <Text size="xs" c="dimmed" lh={1.3} mt={2}>
            {t("control.todayIn")}
          </Text>
        </Card>
        <Card withBorder radius="md" padding="sm">
          <Text fz={26} fw={700} c={data.counts.todayFail > 0 ? "red.7" : "steel.7"} lh={1.1}>
            {data.counts.todayFail}
          </Text>
          <Text size="xs" c="dimmed" lh={1.3} mt={2}>
            {t("control.todayFail")}
          </Text>
        </Card>
      </SimpleGrid>

      {/* ── Бэкап ── */}
      <Card withBorder radius="md" padding="sm">
        <Group gap="sm" wrap="nowrap">
          <IconDatabase size={20} color="var(--mantine-color-steel-6)" />
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" fw={600}>
              {t("control.backup")}
            </Text>
            <Text size="xs" c={data.lastBackupAt ? "dimmed" : "red.7"}>
              {data.lastBackupAt
                ? timeAgo(data.lastBackupAt, t)
                : t("control.backupNever")}
            </Text>
          </Box>
        </Group>
      </Card>

      {/* ── Кто в сети ── */}
      <Box>
        <Group gap={8} mb="xs">
          <IconUsers size={18} color="var(--mantine-color-steel-6)" />
          <Text fw={600}>{t("control.who")}</Text>
          <Text size="xs" c="dimmed">
            {t("control.onlineMeans", { n: data.onlineMin })}
          </Text>
        </Group>

        <Card withBorder radius="md" padding={0}>
          {data.people.length === 0 ? (
            <Text size="sm" c="dimmed" p="md">
              {t("control.nobody")}
            </Text>
          ) : (
            <Stack gap={0}>
              {data.people.map((p) => (
                <Group
                  key={p.id}
                  justify="space-between"
                  wrap="nowrap"
                  px="md"
                  py="xs"
                  style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}
                >
                  <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                    <Box
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        flex: "none",
                        background: `var(--mantine-color-${STATE_COLOR[p.state]}-6)`,
                      }}
                    />
                    <Box style={{ minWidth: 0 }}>
                      <Text size="sm" fw={600} truncate>
                        {p.name}
                      </Text>
                      <Text size="xs" c="dimmed" truncate>
                        {p.role}
                        {p.seh ? ` · ${p.seh}-sex` : ""}
                      </Text>
                    </Box>
                  </Group>
                  <Group gap="xs" wrap="nowrap">
                    <Text size="xs" c="dimmed" ta="right" style={{ whiteSpace: "nowrap" }}>
                      {p.state === "online" ? t("control.online") : timeAgo(p.lastSeenAt, t)}
                    </Text>
                    {p.id !== meId && (
                      <Tooltip label={t("control.kick")}>
                        <Button
                          size="compact-xs"
                          color="red"
                          variant="light"
                          onClick={() => confirmKick(p)}
                          aria-label={t("control.kick")}
                        >
                          <IconLogout size={14} />
                        </Button>
                      </Tooltip>
                    )}
                  </Group>
                </Group>
              ))}
            </Stack>
          )}
        </Card>
        {data.offlineCount > 0 && (
          <Text size="xs" c="dimmed" mt={6}>
            {t("control.othersOffline", { n: data.offlineCount })}
          </Text>
        )}
      </Box>

      {/* ── Журнал ── */}
      <Box>
        <Group gap={8} mb="xs">
          <IconDeviceMobile size={18} color="var(--mantine-color-steel-6)" />
          <Text fw={600}>{t("control.log")}</Text>
        </Group>

        <Card withBorder radius="md" padding={0}>
          <ScrollArea>
            <Table striped highlightOnHover miw={760} verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("control.colWho")}</Table.Th>
                  <Table.Th>{t("control.colWhen")}</Table.Th>
                  <Table.Th>{t("control.colDevice")}</Table.Th>
                  <Table.Th>{t("control.colWhere")}</Table.Th>
                  <Table.Th>{t("control.colResult")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.logs.map((l) => (
                  <Table.Tr
                    key={l.id}
                    style={
                      l.success
                        ? undefined
                        : { background: "var(--mantine-color-red-0)" }
                    }
                  >
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        {l.name ?? t("control.unknown")}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {l.loginTried}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" style={{ whiteSpace: "nowrap" }}>
                        {new Date(l.createdAt).toLocaleString()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{deviceLine(l)}</Text>
                    </Table.Td>
                    <Table.Td>
                      {l.gpsLat != null && l.gpsLng != null ? (
                        <>
                          {/* Ссылка на карту: координаты сами по себе
                              ничего не говорят, а по карте видно место. */}
                          <Text
                            size="xs"
                            component="a"
                            href={`https://www.google.com/maps?q=${l.gpsLat},${l.gpsLng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            c="steel.7"
                            fw={600}
                          >
                            {t("control.gps")} ±{Math.round(l.gpsAccuracy ?? 0)} m
                          </Text>
                          <Text size="xs" c="dimmed">
                            {[l.ipCity, l.ipCountry].filter(Boolean).join(", ") || l.ip}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Text size="xs">
                            {[l.ipCity, l.ipCountry].filter(Boolean).join(", ") || "—"}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {l.ip ?? "—"} · {t("control.byIp")}
                          </Text>
                        </>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {l.success ? (
                        <Badge color="green" variant="light" size="sm">
                          {t("control.ok")}
                        </Badge>
                      ) : (
                        <Badge
                          color="red"
                          variant="light"
                          size="sm"
                          leftSection={<IconAlertTriangle size={11} />}
                        >
                          {t(`control.reason.${l.reason ?? "bad_password"}`)}
                        </Badge>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Card>
      </Box>
    </Stack>
  );
}
