"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  Group,
  Text,
  Badge,
  Button,
  Center,
  Loader,
  Stack,
  ThemeIcon,
  SimpleGrid,
  Modal,
  Textarea,
  Alert,
  Box,
  Collapse,
  UnstyledButton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconClipboardList,
  IconExternalLink,
  IconThumbUp,
  IconThumbDown,
  IconAlertTriangle,
  IconLock,
  IconHourglass,
  IconChevronRight,
  IconChevronDown,
  IconCalendarEvent,
} from "@tabler/icons-react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/client";
import { Page, PageHeader } from "@/components/Page";
import { useI18n } from "@/components/I18nProvider";
import { pickName } from "@/lib/i18n/translations";
import { formatDate } from "@/lib/format";

interface WagonInfo {
  id: string;
  nameRu: string;
  nameUz: string | null;
  number: string;
  wagonType: { nameRu: string; nameUz: string | null };
  done: number;
  total: number;
}
interface TaskWork {
  number: number;
  nameRu: string | null;
  nameUz: string;
  seh: string | null;
  workerCount: number | null;
}
interface Task {
  wagon: WagonInfo;
  stageId: string;
  stageNumber: number;
  stageNameRu: string;
  stageNameUz: string | null;
  dayIndex: number;
  date: string;
  works: TaskWork[];
}
interface MineStage {
  stageId: string;
  stageNumber: number;
  stageNameRu: string;
  stageNameUz: string | null;
  status: "pending" | "in_progress" | "done" | "blocked";
  locked: boolean;
  acceptedDays: number;
  totalDays: number;
  wagon: WagonInfo;
}
interface MyCreation {
  wagonId: string;
  nameRu: string;
  nameUz: string | null;
  number: string;
  wagonType: { nameRu: string; nameUz: string | null };
  createdAt: string;
  myDecision: "pending" | "approved" | "denied";
  myTurn: boolean;
  approval: { approved: number; total: number };
}

export default function MyStagesPage() {
  const { t, lang } = useI18n();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [mine, setMine] = useState<MineStage[]>([]);
  const [creations, setCreations] = useState<MyCreation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // отказ в приёмке дня — причина обязательна
  const [rejectTask, setRejectTask] = useState<Task | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [rejectSaving, setRejectSaving] = useState(false);

  // отказ согласования создания вагона
  const [denyCreation, setDenyCreation] = useState<MyCreation | null>(null);
  const [cDenyComment, setCDenyComment] = useState("");
  const [cDenySaving, setCDenySaving] = useState(false);

  // свёрнутые группы «в очереди»
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpened((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await apiFetch<{
        tasks: Task[];
        mine: MineStage[];
        creations: MyCreation[];
      }>("/api/my-stages");
      setTasks(r.tasks ?? []);
      setMine(r.mine ?? []);
      setCreations(r.creations ?? []);
    } catch (e: any) {
      notifications.show({ color: "red", message: e.message });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // не опрашиваем сервер, пока вкладка/приложение в фоне
    const timer = setInterval(() => {
      if (!document.hidden) load(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [load]);

  async function patch(stageId: string, body: any, key: string, okMsg: string) {
    setBusy(key);
    try {
      await apiFetch(`/api/wagon-stages/${stageId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      notifications.show({ color: "teal", message: okMsg });
      await load(true);
      return true;
    } catch (e: any) {
      notifications.show({ color: "red", message: e.message });
      return false;
    } finally {
      setBusy(null);
    }
  }

  // приёмка дня
  function accept(task: Task) {
    patch(
      task.stageId,
      { action: "signoff", dayIndex: task.dayIndex, decision: "accepted" },
      `${task.stageId}-${task.dayIndex}`,
      t("wd.signed")
    );
  }
  async function submitReject() {
    if (!rejectTask) return;
    setRejectSaving(true);
    const ok = await patch(
      rejectTask.stageId,
      { action: "signoff", dayIndex: rejectTask.dayIndex, decision: "rejected", comment: rejectComment },
      `${rejectTask.stageId}-${rejectTask.dayIndex}`,
      t("wd.rejected")
    );
    setRejectSaving(false);
    if (ok) {
      setRejectTask(null);
      setRejectComment("");
    }
  }

  async function patchCreation(wagonId: string, body: any, key: string, okMsg: string) {
    setBusy(key);
    try {
      await apiFetch(`/api/wagons/${wagonId}/creation`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      notifications.show({ color: "teal", message: okMsg });
      await load(true);
      return true;
    } catch (e: any) {
      notifications.show({ color: "red", message: e.message });
      return false;
    } finally {
      setBusy(null);
    }
  }
  async function submitCreationDeny() {
    if (!denyCreation) return;
    setCDenySaving(true);
    const ok = await patchCreation(
      denyCreation.wagonId,
      { action: "deny", comment: cDenyComment },
      "cdeny",
      t("wd.denied")
    );
    setCDenySaving(false);
    if (ok) {
      setDenyCreation(null);
      setCDenyComment("");
    }
  }

  // разделяем «мои позиции» на завершённые, в работе и в очереди
  const taskStageIds = new Set(tasks.map((x) => x.stageId));
  const doneStages = mine.filter((m) => m.status === "done");
  const pending = mine.filter((m) => m.status !== "done" && !taskStageIds.has(m.stageId));

  // «в очереди» группируем по вагону
  const groups = new Map<string, { wagon: WagonInfo; stages: MineStage[] }>();
  for (const s of pending) {
    const g = groups.get(s.wagon.id) ?? { wagon: s.wagon, stages: [] };
    g.stages.push(s);
    groups.set(s.wagon.id, g);
  }

  const nothing = tasks.length === 0 && mine.length === 0 && creations.length === 0;

  return (
    <Page>
      <PageHeader title={t("my.title")} subtitle={t("my.subtitle")} />

      {loading ? (
        <Center py={60}>
          <Loader />
        </Center>
      ) : nothing ? (
        <Card>
          <Center py={60}>
            <Stack align="center">
              <ThemeIcon size={60} radius="xl" variant="light" color="steel">
                <IconClipboardList size={32} />
              </ThemeIcon>
              <Text c="dimmed">{t("my.empty")}</Text>
            </Stack>
          </Center>
        </Card>
      ) : (
        <Stack gap="xl">
          {/* ── Согласование создания вагонов ── */}
          {creations.length > 0 && (
            <div>
              <Text fw={700} mb="sm">
                {t("my.creations", { n: creations.length })}
              </Text>
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                {creations.map((c) => (
                  <Card
                    key={c.wagonId}
                    p="lg"
                    withBorder
                    style={{ borderLeft: "4px solid var(--mantine-color-yellow-5)" }}
                  >
                    <Group justify="space-between" mb="xs">
                      <Badge variant="light" color="yellow">
                        {t("wagons.awaitingCreation")}
                      </Badge>
                      <Button
                        component={Link}
                        href={`/dashboard/wagons/${c.wagonId}`}
                        variant="subtle"
                        size="compact-xs"
                        rightSection={<IconExternalLink size={12} />}
                      >
                        {t("my.wagonLink")}
                      </Button>
                    </Group>
                    <Text fw={700}>{pickName(c, lang)}</Text>
                    <Text size="xs" c="dimmed" mb="sm">
                      № {c.number} · {pickName(c.wagonType, lang)}
                    </Text>
                    <Group justify="space-between" align="center" mt="md" wrap="wrap">
                      <Text size="xs" c="dimmed">
                        {t("wd.approvals", { a: c.approval.approved, t: c.approval.total })}
                      </Text>
                      {c.myDecision === "pending" ? (
                        c.myTurn ? (
                          <Group gap="xs">
                            <Button
                              color="teal"
                              leftSection={<IconThumbUp size={16} />}
                              loading={busy === c.wagonId + "capprove"}
                              onClick={() =>
                                patchCreation(
                                  c.wagonId,
                                  { action: "approve" },
                                  c.wagonId + "capprove",
                                  t("wd.approved")
                                )
                              }
                            >
                              {t("my.approve")}
                            </Button>
                            <Button
                              color="red"
                              variant="light"
                              leftSection={<IconThumbDown size={16} />}
                              onClick={() => {
                                setDenyCreation(c);
                                setCDenyComment("");
                              }}
                            >
                              {t("my.deny")}
                            </Button>
                          </Group>
                        ) : (
                          <Badge color="gray" variant="light" leftSection={<IconHourglass size={12} />}>
                            {t("wd.waitTurn")}
                          </Badge>
                        )
                      ) : (
                        <Badge color={c.myDecision === "approved" ? "teal" : "red"} variant="light">
                          {t(`decision.${c.myDecision}`)}
                        </Badge>
                      )}
                    </Group>
                  </Card>
                ))}
              </SimpleGrid>
            </div>
          )}

          {/* ── Что ждёт лично меня: конкретные дни на приёмку ── */}
          {tasks.length === 0 ? (
            mine.length > 0 && (
              <Card
                p="md"
                withBorder
                style={{ background: "var(--mantine-color-teal-0)", borderColor: "var(--mantine-color-teal-2)" }}
              >
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon color="teal" variant="light" radius="xl" size={34}>
                    <IconCheck size={18} />
                  </ThemeIcon>
                  <div>
                    <Text fw={700} size="sm" c="teal.9">
                      {t("my.nothingForYou")}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t("my.nothingForYou.sub", { n: pending.length })}
                    </Text>
                  </div>
                </Group>
              </Card>
            )
          ) : (
            <div>
              <Text fw={800} size="15px">
                {t("my.waitingOnYou", { n: tasks.length })}
              </Text>
              <Text size="xs" c="dimmed" mb="sm">
                {t("my.waitingOnYou.sub")}
              </Text>
              <Stack gap="md">
                {tasks.map((task, i) => (
                  <motion.div
                    key={`${task.stageId}-${task.dayIndex}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.3 }}
                  >
                    <Card withBorder p="md" radius="md" style={{ borderLeft: "4px solid var(--mantine-color-steel-6)" }}>
                      {/* вагон + позиция */}
                      <Group justify="space-between" wrap="wrap" gap="xs" mb={8}>
                        <div style={{ minWidth: 0 }}>
                          <Text size="12px" c="dimmed">
                            {pickName(task.wagon, lang)} · №{task.wagon.number}
                          </Text>
                          <Text fw={600} c="#25324d" style={{ wordBreak: "break-word" }}>
                            {t("wd.stage", {
                              number: task.stageNumber,
                              name: pickName({ nameRu: task.stageNameRu, nameUz: task.stageNameUz }, lang),
                            })}
                          </Text>
                        </div>
                        <Button
                          component={Link}
                          href={`/dashboard/wagons/${task.wagon.id}`}
                          variant="subtle"
                          size="compact-xs"
                          rightSection={<IconExternalLink size={12} />}
                          style={{ flex: "none" }}
                        >
                          {t("my.wagonLink")}
                        </Button>
                      </Group>

                      {/* день + дата */}
                      <Group gap={7} wrap="nowrap" mb={8}>
                        <ThemeIcon size={22} radius="sm" variant="light" color="steel">
                          <IconCalendarEvent size={13} />
                        </ThemeIcon>
                        <Text size="sm" fw={600} c="steel.8">
                          {t("wd.day", { n: task.dayIndex })} · {formatDate(task.date)}
                        </Text>
                      </Group>

                      {/* работы этого дня (без часов) */}
                      <Box
                        p="xs"
                        mb="sm"
                        style={{ borderRadius: 8, background: "var(--mantine-color-gray-0)" }}
                      >
                        {task.works.map((w, wi) => (
                          <Group key={wi} gap={8} wrap="nowrap" py={3} align="flex-start">
                            <Text size="12.5px" c="gray.5" fw={600} w={14} ta="right" mt={2}>
                              {w.number}
                            </Text>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <Text size="13.5px" c="#3a465e" lh={1.45} style={{ wordBreak: "break-word" }}>
                                {pickName(w, lang)}
                              </Text>
                              <Group gap={8} mt={3} wrap="wrap">
                                {w.seh && (
                                  <Text size="11.5px" c="steel.6" fw={600}>
                                    {t("wd.sehShort", { n: w.seh })}
                                  </Text>
                                )}
                                {!!w.workerCount && (
                                  <Text size="11.5px" c="gray.6">
                                    {t("wd.workers", { n: w.workerCount })}
                                  </Text>
                                )}
                              </Group>
                            </div>
                          </Group>
                        ))}
                      </Box>

                      {/* приёмка */}
                      <Group justify="flex-end" gap="xs">
                        <Button
                          color="red"
                          variant="subtle"
                          leftSection={<IconThumbDown size={16} />}
                          onClick={() => {
                            setRejectTask(task);
                            setRejectComment("");
                          }}
                        >
                          {t("wd.reject")}
                        </Button>
                        <Button
                          color="teal"
                          leftSection={<IconCheck size={16} />}
                          loading={busy === `${task.stageId}-${task.dayIndex}`}
                          onClick={() => accept(task)}
                        >
                          {t("wd.sign")}
                        </Button>
                      </Group>
                    </Card>
                  </motion.div>
                ))}
              </Stack>
            </div>
          )}

          {/* ── В работе / в очереди: мои позиции без действий прямо сейчас ── */}
          {groups.size > 0 && (
            <div>
              <Text fw={700} mb="sm">
                {t("my.inProgress")}
              </Text>
              <Stack gap="md">
                {[...groups.values()].map((g) => {
                  const isOpen = opened.has(g.wagon.id);
                  return (
                    <Card key={g.wagon.id} p="lg">
                      <Group
                        justify="space-between"
                        wrap="nowrap"
                        pb="sm"
                        mb="sm"
                        style={{ borderBottom: "1px solid var(--mantine-color-gray-1)" }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <Text fw={800} size="15px" truncate>
                            {pickName(g.wagon, lang)} · №{g.wagon.number}
                          </Text>
                          <Text size="11.5px" c="dimmed" truncate>
                            {pickName(g.wagon.wagonType, lang)} ·{" "}
                            {t("my.wagonProgress", { done: g.wagon.done, total: g.wagon.total })}
                          </Text>
                        </div>
                        <Button
                          component={Link}
                          href={`/dashboard/wagons/${g.wagon.id}`}
                          variant="subtle"
                          size="compact-xs"
                          rightSection={<IconExternalLink size={12} />}
                          style={{ flex: "none" }}
                        >
                          {t("my.wagonLink")}
                        </Button>
                      </Group>

                      <UnstyledButton onClick={() => toggle(g.wagon.id)} w="100%">
                        <Group
                          gap={8}
                          p={11}
                          style={{
                            borderRadius: 10,
                            background: "var(--mantine-color-gray-0)",
                            border: "1px dashed var(--mantine-color-gray-3)",
                          }}
                        >
                          {isOpen ? (
                            <IconChevronDown size={14} color="var(--mantine-color-gray-6)" />
                          ) : (
                            <IconChevronRight size={14} color="var(--mantine-color-gray-6)" />
                          )}
                          <Text size="xs" c="dimmed">
                            {t("my.myStagesCount", { n: g.stages.length })}
                          </Text>
                          <Text size="xs" fw={700} c="steel.6">
                            {isOpen ? t("my.hide") : t("my.show")}
                          </Text>
                        </Group>
                      </UnstyledButton>

                      <Collapse in={isOpen}>
                        <Stack gap={0} mt={4}>
                          {g.stages.map((s, i) => (
                            <Group
                              key={s.stageId}
                              wrap="nowrap"
                              gap="sm"
                              py={9}
                              align="flex-start"
                              style={{
                                borderBottom:
                                  i < g.stages.length - 1
                                    ? "1px solid var(--mantine-color-gray-1)"
                                    : undefined,
                              }}
                            >
                              <ThemeIcon
                                size={26}
                                radius="sm"
                                variant="light"
                                color={s.status === "blocked" ? "red" : s.locked ? "gray" : "steel"}
                              >
                                {s.locked ? <IconLock size={13} /> : <Text size="11px" fw={800}>{s.stageNumber}</Text>}
                              </ThemeIcon>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <Text size="13px" c="#25324d" style={{ wordBreak: "break-word" }}>
                                  {pickName({ nameRu: s.stageNameRu, nameUz: s.stageNameUz }, lang)}
                                </Text>
                                <Text size="11px" c="dimmed">
                                  {s.locked
                                    ? t("my.locked", { n: s.stageNumber - 1 })
                                    : t("my.acceptedDays", { a: s.acceptedDays, t: s.totalDays })}
                                </Text>
                              </div>
                              {s.status === "blocked" && (
                                <Badge color="red" variant="light" size="sm" style={{ flex: "none" }}>
                                  {t("sstatus.blocked")}
                                </Badge>
                              )}
                            </Group>
                          ))}
                        </Stack>
                      </Collapse>
                    </Card>
                  );
                })}
              </Stack>
            </div>
          )}

          {/* ── Завершённые мной позиции ── */}
          {doneStages.length > 0 && (
            <div>
              <Text fw={700} mb="sm">
                {t("my.finished", { n: doneStages.length })}
              </Text>
              <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
                {doneStages.map((s) => (
                  <Card
                    key={s.stageId}
                    p="md"
                    withBorder
                    style={{ borderLeft: "4px solid var(--mantine-color-teal-6)" }}
                  >
                    <Group gap="xs" wrap="nowrap" align="flex-start">
                      <ThemeIcon color="teal" variant="light" radius="xl">
                        <IconCheck size={16} />
                      </ThemeIcon>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Text size="sm" fw={600} style={{ wordBreak: "break-word" }}>
                          {t("wd.stage", {
                            number: s.stageNumber,
                            name: pickName({ nameRu: s.stageNameRu, nameUz: s.stageNameUz }, lang),
                          })}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {pickName(s.wagon, lang)} · № {s.wagon.number}
                        </Text>
                        <Text size="11px" c="teal.7" mt={4}>
                          {t("wd.stageDone")}
                        </Text>
                      </div>
                    </Group>
                  </Card>
                ))}
              </SimpleGrid>
            </div>
          )}
        </Stack>
      )}

      {/* Отказ в приёмке дня — причина обязательна */}
      <Modal
        opened={!!rejectTask}
        onClose={() => setRejectTask(null)}
        title={t("wd.rejectTitle")}
        radius="md"
      >
        <Stack>
          <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />} p="sm">
            <Text size="sm">{t("wd.rejectAlert")}</Text>
          </Alert>
          <Textarea
            label={t("wd.rejectReason")}
            placeholder={t("wd.rejectPlaceholder")}
            minRows={3}
            autosize
            withAsterisk
            value={rejectComment}
            onChange={(e) => setRejectComment(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRejectTask(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              color="red"
              onClick={submitReject}
              loading={rejectSaving}
              disabled={rejectComment.trim().length < 3}
            >
              {t("wd.reject")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Отказ согласования создания */}
      <Modal
        opened={!!denyCreation}
        onClose={() => setDenyCreation(null)}
        title={t("wd.creationTitle")}
      >
        <Stack>
          <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
            {t("wd.denyAlert")}
          </Alert>
          <Textarea
            label={t("wd.denyReason")}
            placeholder={t("wd.denyPlaceholder")}
            minRows={3}
            autosize
            withAsterisk
            value={cDenyComment}
            onChange={(e) => setCDenyComment(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDenyCreation(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" onClick={submitCreationDeny} loading={cDenySaving}>
              {t("my.deny")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Page>
  );
}
