"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  IconPlayerPlay,
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
} from "@tabler/icons-react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/client";
import { Page, PageHeader } from "@/components/Page";
import { Countdown } from "@/components/Countdown";
import { useCan } from "@/components/UserContext";
import { useI18n } from "@/components/I18nProvider";
import { pickName } from "@/lib/i18n/translations";
import { formatDuration, formatDateTime } from "@/lib/format";

interface MyStage {
  id: string;
  number: number;
  nameRu: string;
  nameUz: string | null;
  durationSeconds: number;
  status: "pending" | "awaiting" | "ready" | "blocked" | "in_progress" | "overdue" | "done";
  myDecision: "pending" | "approved" | "denied";
  // жму ли я «Старт» / «Завершить» (разрешение дают все назначенные, кнопки — эти)
  canExecute: boolean;
  myTurn: boolean;
  approval: { total: number; approved: number };
  deadline: number | null;
  startedAt: string | null;
  startedBy: { firstName: string; lastName: string; middleName: string | null } | null;
  finishedAt: string | null;
  finishedBy: { firstName: string; lastName: string; middleName: string | null } | null;
  finishComment: string | null;
  deniedBy: { name: string; comment: string | null } | null;
  wagon: {
    id: string;
    nameRu: string;
    nameUz: string | null;
    number: string;
    done: number;
    total: number;
    wagonType: { nameRu: string; nameUz: string | null };
  };
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

const STATUS_COLOR: Record<string, string> = {
  pending: "gray",
  awaiting: "yellow",
  ready: "steel",
  blocked: "red",
  in_progress: "blue",
  overdue: "red",
  done: "teal",
};

// Номер этапа — этапы идут цепочкой, номер важнее названия.
function StageNum({ n, color }: { n: number; color: "steel" | "gray" }) {
  return (
    <Box
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        flex: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `var(--mantine-color-${color}-${color === "steel" ? 0 : 1})`,
        color: `var(--mantine-color-${color}-${color === "steel" ? 7 : 6})`,
        fontSize: 11,
        fontWeight: 800,
      }}
    >
      {n}
    </Box>
  );
}

export default function MyStagesPage() {
  const { t, lang } = useI18n();
  const can = useCan();
  // управляющий может жать кнопки, даже если не отмечен исполнителем
  const isManager = can("wagons", "update");
  const [stages, setStages] = useState<MyStage[]>([]);
  const [creations, setCreations] = useState<MyCreation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const clockOffset = useRef(0);

  const [denyStage, setDenyStage] = useState<MyStage | null>(null);
  const [denyComment, setDenyComment] = useState("");
  const [denySaving, setDenySaving] = useState(false);

  // завершение с обязательной причиной отклонения от норматива
  const [finishStage, setFinishStage] = useState<MyStage | null>(null);
  const [finishComment, setFinishComment] = useState("");
  const [finishSaving, setFinishSaving] = useState(false);

  // отказ согласования создания
  const [denyCreation, setDenyCreation] = useState<MyCreation | null>(null);
  const [cDenyComment, setCDenyComment] = useState("");
  const [cDenySaving, setCDenySaving] = useState(false);

  // какие вагоны развернули — очередь по умолчанию свёрнута
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
        stages: MyStage[];
        creations: MyCreation[];
        serverNow: number;
      }>("/api/my-stages");
      clockOffset.current = r.serverNow - Date.now();
      setStages(r.stages);
      setCreations(r.creations ?? []);
    } catch (e: any) {
      notifications.show({ color: "red", message: e.message });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 5000);
    return () => clearInterval(t);
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

  async function submitFinish() {
    if (!finishStage) return;
    setFinishSaving(true);
    const ok = await patch(
      finishStage.id,
      { action: "finish", comment: finishComment },
      finishStage.id + "finish",
      t("wd.finished")
    );
    setFinishSaving(false);
    if (ok) {
      setFinishStage(null);
      setFinishComment("");
    }
  }

  async function submitDeny() {
    if (!denyStage) return;
    setDenySaving(true);
    const ok = await patch(
      denyStage.id,
      { action: "deny", comment: denyComment },
      "deny",
      t("wd.denied")
    );
    setDenySaving(false);
    if (ok) {
      setDenyStage(null);
      setDenyComment("");
    }
  }

  async function patchCreation(
    wagonId: string,
    body: any,
    key: string,
    okMsg: string
  ) {
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

  const active = stages.filter((s) => s.status !== "done");
  const finished = stages.filter((s) => s.status === "done");

  // Что я реально могу сделать ПРЯМО СЕЙЧАС. Всё остальное — ожидание,
  // и вываливать его карточками бессмысленно: действий там нет.
  function isActionable(s: MyStage) {
    const canAct = s.canExecute || isManager;
    if (s.status === "awaiting") return s.myDecision === "pending" && s.myTurn;
    if (s.status === "ready") return canAct;
    if (s.status === "in_progress" || s.status === "overdue") return canAct;
    return false;
  }

  const waitingOnMe = active.filter(isActionable);
  const queued = active.filter((s) => !isActionable(s));

  // Остальное группируем по вагону — иначе его название повторяется 17 раз.
  const groups = new Map<string, { wagon: MyStage["wagon"]; stages: MyStage[] }>();
  for (const s of queued) {
    const g = groups.get(s.wagon.id) ?? { wagon: s.wagon, stages: [] };
    g.stages.push(s);
    groups.set(s.wagon.id, g);
  }

  function renderActions(s: MyStage) {
    // разрешение даю как все назначенные, а кнопки — только если я исполнитель
    const canAct = s.canExecute || isManager;
    if (s.status === "awaiting" && s.myDecision === "pending") {
      return (
        <Group gap="xs">
          {s.myTurn ? (
            <Button
              color="teal"
              leftSection={<IconThumbUp size={16} />}
              loading={busy === s.id + "approve"}
              onClick={() =>
                patch(s.id, { action: "approve" }, s.id + "approve", t("wd.approved"))
              }
            >
              {t("my.approve")}
            </Button>
          ) : (
            <Badge color="gray" variant="light" leftSection={<IconHourglass size={12} />}>
              {t("wd.waitTurn")}
            </Badge>
          )}
          <Button
            color="red"
            variant="light"
            leftSection={<IconThumbDown size={16} />}
            onClick={() => {
              setDenyStage(s);
              setDenyComment("");
            }}
          >
            {t("my.deny")}
          </Button>
        </Group>
      );
    }
    if (s.status === "awaiting" && s.myDecision === "approved") {
      return (
        <Badge color="teal" variant="light" leftSection={<IconHourglass size={12} />}>
          {t("my.waitingOthers", { a: s.approval.approved, t: s.approval.total })}
        </Badge>
      );
    }
    if (s.status === "ready") {
      // не исполнитель — этап запустит тот, кто отмечен
      if (!canAct) {
        return (
          <Badge color="gray" variant="light" leftSection={<IconHourglass size={12} />}>
            {t("my.waitExecutor")}
          </Badge>
        );
      }
      return (
        <Button
          color="blue"
          leftSection={<IconPlayerPlay size={16} />}
          loading={busy === s.id + "start"}
          onClick={() => patch(s.id, { action: "start" }, s.id + "start", t("wd.started"))}
        >
          {t("my.start")}
        </Button>
      );
    }
    if (s.status === "in_progress" || s.status === "overdue") {
      if (!canAct) return null;
      return (
        <Button
          color="teal"
          leftSection={<IconCheck size={16} />}
          loading={busy === s.id + "finish"}
          onClick={() => {
            setFinishStage(s);
            setFinishComment("");
          }}
        >
          {t("my.finish")}
        </Button>
      );
    }
    if (s.status === "blocked") {
      return (
        <Badge color="red" variant="light" leftSection={<IconLock size={12} />}>
          {t("my.sstatus.blocked")}
        </Badge>
      );
    }
    return null;
  }

  return (
    <Page>
      <PageHeader title={t("my.title")} subtitle={t("my.subtitle")} />

      {loading ? (
        <Center py={60}>
          <Loader />
        </Center>
      ) : stages.length === 0 && creations.length === 0 ? (
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
          {/* Согласование создания вагонов */}
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
                        {t("wd.approvals", {
                          a: c.approval.approved,
                          t: c.approval.total,
                        })}
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
                        <Badge
                          color={c.myDecision === "approved" ? "teal" : "red"}
                          variant="light"
                        >
                          {t(`decision.${c.myDecision}`)}
                        </Badge>
                      )}
                    </Group>
                  </Card>
                ))}
              </SimpleGrid>
            </div>
          )}

          {active.length > 0 && (
            <div>
              {/* ── Что ждёт лично меня ── */}
              {waitingOnMe.length === 0 ? (
                <Card p="md" withBorder style={{ background: "var(--mantine-color-teal-0)", borderColor: "var(--mantine-color-teal-2)" }}>
                  <Group gap="sm" wrap="nowrap">
                    <ThemeIcon color="teal" variant="light" radius="xl" size={34}>
                      <IconCheck size={18} />
                    </ThemeIcon>
                    <div>
                      <Text fw={700} size="sm" c="teal.9">
                        {t("my.nothingForYou")}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t("my.nothingForYou.sub", { n: active.length })}
                      </Text>
                    </div>
                  </Group>
                </Card>
              ) : (
                <Card p="lg" style={{ borderLeft: "4px solid var(--mantine-color-steel-6)" }}>
                  <Text fw={800} size="15px">
                    {t("my.waitingOnYou", { n: waitingOnMe.length })}
                  </Text>
                  <Text size="xs" c="dimmed" mb="xs">
                    {t("my.waitingOnYou.sub")}
                  </Text>
                  <Stack gap={0}>
                    {waitingOnMe.map((s, i) => (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06, duration: 0.3 }}
                      >
                        <Group
                          wrap="nowrap"
                          gap="sm"
                          py="sm"
                          style={{
                            borderBottom:
                              i < waitingOnMe.length - 1
                                ? "1px solid var(--mantine-color-gray-1)"
                                : undefined,
                          }}
                        >
                          <StageNum n={s.number} color="steel" />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <Text size="13.5px" fw={600} truncate>
                              {pickName(s, lang)}
                            </Text>
                            <Text size="11px" c="dimmed" truncate>
                              {pickName(s.wagon, lang)} №{s.wagon.number} ·{" "}
                              {t("wd.norm", { dur: formatDuration(s.durationSeconds, lang) })}
                            </Text>
                          </div>
                          {(s.status === "in_progress" || s.status === "overdue") &&
                            s.deadline && (
                              <Countdown
                                deadline={s.deadline}
                                durationSeconds={s.durationSeconds}
                                clockOffset={clockOffset.current}
                              />
                            )}
                          {renderActions(s)}
                        </Group>
                      </motion.div>
                    ))}
                  </Stack>
                </Card>
              )}

              {/* ── Остальное: по вагонам, очередь свёрнута ── */}
              {[...groups.values()].map((g, gi) => {
                const blocked = g.stages.find((s) => s.status === "blocked");
                const queue = g.stages.filter((s) => s.status !== "blocked");
                const isOpen = opened.has(g.wagon.id);
                const from = queue[0]?.number;
                const to = queue[queue.length - 1]?.number;
                return (
                  <motion.div
                    key={g.wagon.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + gi * 0.07, duration: 0.3 }}
                  >
                    <Card p="lg" mt="md">
                      <Group justify="space-between" wrap="nowrap" mb="sm" pb="sm" style={{ borderBottom: "1px solid var(--mantine-color-gray-1)" }}>
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

                      {/* Почему всё стоит */}
                      {blocked && (
                        <Alert
                          color="red"
                          variant="light"
                          icon={<IconLock size={16} />}
                          mb={queue.length ? "sm" : 0}
                          title={t("my.blockedTitle", { n: blocked.number })}
                        >
                          <Text size="xs">
                            {blocked.deniedBy && (
                              <>
                                {t("home.att.by", { who: blocked.deniedBy.name })}
                                {blocked.deniedBy.comment && `: «${blocked.deniedBy.comment}»`}
                                <br />
                              </>
                            )}
                            {queue.length > 0 && (
                              <Text span fw={600}>
                                {t("my.blockedTail", { n: queue.length })}
                              </Text>
                            )}
                          </Text>
                        </Alert>
                      )}

                      {/* Очередь — свёрнута, потому что действий там нет */}
                      {queue.length > 0 && (
                        <>
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
                                {t("my.queued", { n: queue.length, from, to })}
                              </Text>
                              <Text size="xs" fw={700} c="steel.6">
                                {isOpen ? t("my.hide") : t("my.show")}
                              </Text>
                            </Group>
                          </UnstyledButton>

                          <Collapse in={isOpen}>
                            <Stack gap={0} mt={4}>
                              {queue.map((s, i) => (
                                <Group
                                  key={s.id}
                                  wrap="nowrap"
                                  gap="sm"
                                  py={9}
                                  style={{
                                    borderBottom:
                                      i < queue.length - 1
                                        ? "1px solid var(--mantine-color-gray-1)"
                                        : undefined,
                                  }}
                                >
                                  <StageNum n={s.number} color="gray" />
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <Text size="13px" truncate>
                                      {pickName(s, lang)}
                                    </Text>
                                    <Text size="11px" c="dimmed" truncate>
                                      {t("my.waitsFor", { n: s.number - 1 })}
                                    </Text>
                                  </div>
                                  {renderActions(s)}
                                </Group>
                              ))}
                            </Stack>
                          </Collapse>
                        </>
                      )}
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}

          {finished.length > 0 && (
            <div>
              <Text fw={700} mb="sm">
                {t("my.finished", { n: finished.length })}
              </Text>
              <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
                {finished.map((s) => (
                  <Card
                    key={s.id}
                    p="md"
                    withBorder
                    style={{
                      borderLeft: "4px solid var(--mantine-color-teal-6)",
                    }}
                  >
                    <Group gap="xs" wrap="nowrap" align="flex-start">
                      <ThemeIcon color="teal" variant="light" radius="xl">
                        <IconCheck size={16} />
                      </ThemeIcon>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Text size="sm" fw={600}>
                          {t("wd.stage", { number: s.number, name: pickName(s, lang) })}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {pickName(s.wagon, lang)} · № {s.wagon.number}
                        </Text>
                        {s.startedBy && s.startedAt && (
                          <Text size="xs" c="dimmed" mt={4}>
                            {t("wd.startedBy")}:{" "}
                            <Text span fw={600} c="dark">
                              {[
                                s.startedBy.lastName,
                                s.startedBy.firstName,
                                s.startedBy.middleName,
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            </Text>{" "}
                            · {formatDateTime(s.startedAt)}
                          </Text>
                        )}
                        {s.finishedBy && s.finishedAt && (
                          <Text size="xs" c="dimmed" mt={4}>
                            {t("wd.finishedBy")}:{" "}
                            <Text span fw={600} c="dark">
                              {[
                                s.finishedBy.lastName,
                                s.finishedBy.firstName,
                                s.finishedBy.middleName,
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            </Text>{" "}
                            · {formatDateTime(s.finishedAt)}
                          </Text>
                        )}
                        {s.finishedAt &&
                          s.deadline &&
                          (() => {
                            const late =
                              new Date(s.finishedAt).getTime() > s.deadline;
                            return (
                              <Text
                                size="11px"
                                mt={4}
                                fw={600}
                                c={late ? "red" : "teal"}
                              >
                                {late ? t("wd.finishLate") : t("wd.finishEarly")}
                                {s.finishComment ? ` · «${s.finishComment}»` : ""}
                              </Text>
                            );
                          })()}
                      </div>
                    </Group>
                  </Card>
                ))}
              </SimpleGrid>
            </div>
          )}
        </Stack>
      )}

      {/* Завершение — обязательна причина отклонения от норматива */}
      <Modal
        opened={!!finishStage}
        onClose={() => setFinishStage(null)}
        title={finishStage ? t("wd.finishTitle", { number: finishStage.number }) : ""}
      >
        <Stack>
          {finishStage &&
            (() => {
              const planned = finishStage.deadline;
              const late = planned != null && Date.now() > planned;
              return (
                <Alert
                  color={late ? "red" : "teal"}
                  variant="light"
                  icon={<IconAlertTriangle size={16} />}
                  title={late ? t("wd.finishLate") : t("wd.finishEarly")}
                >
                  {planned && (
                    <Text size="sm">
                      {t("wd.finishPlanned")}:{" "}
                      <Text span fw={600}>
                        {formatDateTime(new Date(planned))}
                      </Text>
                    </Text>
                  )}
                  <Text size="sm">{t("wd.finishReasonHint")}</Text>
                </Alert>
              );
            })()}
          <Textarea
            label={t("wd.finishReason")}
            placeholder={t("wd.finishPlaceholder")}
            minRows={3}
            autosize
            withAsterisk
            value={finishComment}
            onChange={(e) => setFinishComment(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setFinishStage(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="teal" onClick={submitFinish} loading={finishSaving}>
              {t("my.finish")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={!!denyStage}
        onClose={() => setDenyStage(null)}
        title={denyStage ? t("wd.denyTitle", { number: denyStage.number }) : ""}
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
            value={denyComment}
            onChange={(e) => setDenyComment(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDenyStage(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" onClick={submitDeny} loading={denySaving}>
              {t("my.deny")}
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
