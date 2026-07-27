"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  Group,
  Text,
  Badge,
  Button,
  Center,
  Loader,
  Stack,
  Box,
  Avatar,
  ThemeIcon,
  Timeline,
  Tooltip,
  Modal,
  Progress,
  Alert,
  Textarea,
  ActionIcon,
  Checkbox,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowLeft,
  IconCheck,
  IconUsersGroup,
  IconAlertTriangle,
  IconRefresh,
  IconThumbUp,
  IconThumbDown,
  IconLock,
  IconHourglass,
  IconRotateClockwise,
  IconX,
  IconCalendar,
  IconCalendarClock,
  IconCalendarDue,
  IconCalendarEvent,
} from "@tabler/icons-react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/client";
import { Page } from "@/components/Page";
import { useUser, useCan } from "@/components/UserContext";
import { useI18n } from "@/components/I18nProvider";
import { pickName } from "@/lib/i18n/translations";
import {
  formatDate,
  formatDateTime,
  businessDaysUntil,
  wagonSchedule,
  splitWorksIntoDays,
} from "@/lib/format";

interface Assignee {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  photo: string | null;
  seh: string | null;
  role: { nameRu: string; nameUz: string | null };
  canExecute: boolean;
}
interface StageWork {
  id: string;
  number: number;
  nameRu: string | null;
  nameUz: string;
  hours: number;
  seh: string | null;
  workerCount: number | null;
}
// подпись одного дня одним человеком
interface Signoff {
  dayIndex: number;
  userId: string;
  decision: "accepted" | "rejected";
  comment: string | null;
  signedAt: string;
}
interface Stage {
  id: string;
  number: number;
  nameRu: string;
  nameUz: string | null;
  durationSeconds: number;
  workerCount: number | null;
  note: string | null;
  works: StageWork[];
  status: "pending" | "in_progress" | "done" | "blocked";
  locked: boolean; // предыдущий этап ещё не завершён — приёмка недоступна
  finishedAt: string | null;
  finishedBy: { firstName: string; lastName: string; middleName: string | null } | null;
  signoffs: Signoff[];
  assignees: Assignee[];
}
interface CreationApprover {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  photo: string | null;
  seh: string | null;
  role: { nameRu: string; nameUz: string | null };
  order: number;
  decision: "pending" | "approved" | "denied";
  comment: string | null;
  decidedAt: string | null;
}
interface WagonDetail {
  id: string;
  nameRu: string;
  nameUz: string | null;
  number: string;
  wagonType: { nameRu: string; nameUz: string | null };
  status: string;
  creationStatus: "pending" | "approved" | "rejected";
  creationApprovers: CreationApprover[];
  createdAt: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  stages: Stage[];
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


function fio(u: { firstName: string; lastName: string; middleName: string | null }) {
  return [u.lastName, u.firstName, u.middleName].filter(Boolean).join(" ");
}

export default function WagonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useUser();
  const can = useCan();
  const { t, lang } = useI18n();
  const isManager = can("wagons", "update");

  const [wagon, setWagon] = useState<WagonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const clockOffset = useRef(0);

  // отказ (создание вагона)
  const [creationDenyOpen, setCreationDenyOpen] = useState(false);
  const [creationDenyComment, setCreationDenyComment] = useState("");
  const [creationDenySaving, setCreationDenySaving] = useState(false);

  // отказ в приёмке дня — с обязательным комментарием
  const [rejectTarget, setRejectTarget] = useState<{
    stageId: string;
    dayIndex: number;
  } | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [rejectSaving, setRejectSaving] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const r = await apiFetch<{ wagon: WagonDetail; serverNow: number }>(
          `/api/wagons/${id}`
        );
        clockOffset.current = r.serverNow - Date.now();
        setWagon(r.wagon);
      } catch (e: any) {
        notifications.show({ color: "red", message: e.message });
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    load();
    // Не опрашиваем сервер, пока вкладка/приложение в фоне: в установленной PWA
    // это лишняя нагрузка и память, из-за которой iOS быстрее убивает процесс.
    const t = setInterval(() => {
      if (!document.hidden) load(true);
    }, 5000);
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

  async function patchCreation(
    body: any,
    key: string,
    okMsg: string
  ): Promise<boolean> {
    setBusy(key);
    try {
      await apiFetch(`/api/wagons/${id}/creation`, {
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
    setCreationDenySaving(true);
    const ok = await patchCreation(
      { action: "deny", comment: creationDenyComment },
      "cdeny",
      t("wd.denied")
    );
    setCreationDenySaving(false);
    if (ok) {
      setCreationDenyOpen(false);
      setCreationDenyComment("");
    }
  }

  // приёмка / отказ / снятие подписи за один рабочий день
  async function signOff(
    stageId: string,
    dayIndex: number,
    decision: "accepted" | "rejected" | "none",
    comment?: string
  ) {
    await patch(
      stageId,
      { action: "signoff", dayIndex, decision, comment },
      `${stageId}-${dayIndex}`,
      decision === "rejected"
        ? t("wd.rejected")
        : decision === "none"
          ? t("wd.unsigned")
          : t("wd.signed")
    );
  }

  async function submitReject() {
    if (!rejectTarget) return;
    setRejectSaving(true);
    await signOff(rejectTarget.stageId, rejectTarget.dayIndex, "rejected", rejectComment);
    setRejectSaving(false);
    setRejectTarget(null);
    setRejectComment("");
  }

  if (loading) {
    return (
      <Center py={100}>
        <Loader />
      </Center>
    );
  }
  if (!wagon) return null;

  const total = wagon.stages.length;
  const done = wagon.stages.filter((s) => s.status === "done").length;
  const pct = total ? (done / total) * 100 : 0;
  const activeIndex = wagon.stages.findIndex((s) => s.status !== "done");
  const wagonBlocked = wagon.status === "blocked";

  // 1-я фаза: согласование создания
  const wagonActive = wagon.creationStatus === "approved";

  // Календарный план дат этапов: считаем от «Ish boshlanish sanasi».
  const scheduleStart = wagon.plannedStart ?? wagon.createdAt;
  const { plan: stagePlan, end: scheduleEnd } = wagonSchedule(
    scheduleStart,
    wagon.stages.map((s) => s.durationSeconds)
  );
  const deadline = wagon.plannedEnd ?? scheduleEnd;
  const myCreationIdx = wagon.creationApprovers.findIndex(
    (a) => a.id === user.id
  );
  const myCreation =
    myCreationIdx >= 0 ? wagon.creationApprovers[myCreationIdx] : undefined;
  const myCreationTurn = wagon.creationApprovers
    .slice(0, myCreationIdx)
    .every((a) => a.decision === "approved");

  return (
    <Page>
      <Button
        variant="subtle"
        leftSection={<IconArrowLeft size={16} />}
        mb="md"
        onClick={() => router.push("/dashboard/wagons")}
      >
        {t("wd.back")}
      </Button>

      <Card mb="lg" p="lg">
        <Group justify="space-between" wrap="wrap">
          <Group>
            <ThemeIcon
              size={54}
              radius="md"
              variant="light"
              color={wagonBlocked ? "red" : "steel"}
            >
              <IconUsersGroup size={28} />
            </ThemeIcon>
            <div>
              <Group gap="xs">
                <Text fw={800} size="xl">
                  {pickName(wagon, lang)}
                </Text>
                {wagonBlocked && (
                  <Badge color="red" variant="filled" leftSection={<IconLock size={12} />}>
                    {t("wd.blocked")}
                  </Badge>
                )}
              </Group>
              <Text c="dimmed" size="sm">
                {t("wd.summary", {
                  number: wagon.number,
                  type: pickName(wagon.wagonType, lang),
                  n: total,
                })}
              </Text>
              <Group gap="sm" mt={6}>
                <Group gap={5}>
                  <IconCalendar size={15} color="var(--mantine-color-gray-6)" />
                  <Text size="xs" c="dimmed">
                    {t("wagons.startAt")}: {formatDate(scheduleStart)}
                  </Text>
                </Group>
                {(() => {
                  const wdLeft = businessDaysUntil(deadline);
                  const wdColor =
                    wdLeft <= 0 ? "red" : wdLeft <= 5 ? "orange" : "teal";
                  return (
                    <>
                      <Group gap={5}>
                        <IconCalendarDue
                          size={15}
                          color="var(--mantine-color-gray-6)"
                        />
                        <Text size="xs" c="dimmed">
                          {t("wagons.deadlineAt")}:{" "}
                          <Text span fw={600} c={wdColor}>
                            {formatDate(deadline)}
                          </Text>
                        </Text>
                      </Group>
                      <Badge
                        variant="light"
                        color={wdColor}
                        leftSection={<IconCalendarClock size={13} />}
                      >
                        {wdLeft <= 0
                          ? t("wagons.overdueDays", { n: Math.abs(wdLeft) })
                          : t("wagons.card.leftDays", { n: wdLeft })}
                      </Badge>
                    </>
                  );
                })()}
              </Group>
            </div>
          </Group>
          <Group>
            <ActionIcon variant="light" size="lg" onClick={() => load(true)} title={t("common.refresh")}>
              <IconRefresh size={18} />
            </ActionIcon>
            <div style={{ minWidth: 220 }}>
              <Group justify="space-between" mb={4}>
                <Text size="sm" fw={600}>
                  {t("wd.progress")}
                </Text>
                <Text size="sm" c="dimmed">
                  {done} / {total}
                </Text>
              </Group>
              <Progress value={pct} radius="xl" size="lg" color="steel" />
            </div>
          </Group>
        </Group>
      </Card>

      {/* 1-я фаза: согласование создания вагона */}
      {!wagonActive && (
        <Card mb="lg" p="lg" style={{ borderColor: "var(--mantine-color-yellow-4)" }}>
          <Group gap="xs" mb="sm">
            <ThemeIcon
              color={wagon.creationStatus === "rejected" ? "red" : "yellow"}
              variant="light"
              radius="xl"
            >
              <IconLock size={16} />
            </ThemeIcon>
            <div>
              <Text fw={700}>{t("wd.approvalSheet")}</Text>
              <Text size="xs" c="dimmed">
                {t("wd.approvalSheet.sub")}
              </Text>
            </div>
          </Group>

          <Alert
            color={wagon.creationStatus === "rejected" ? "red" : "yellow"}
            variant="light"
            mb="md"
            icon={<IconAlertTriangle size={16} />}
          >
            {wagon.creationStatus === "rejected"
              ? t("wd.creationRejectedBanner")
              : t("wd.creationPendingBanner")}
          </Alert>

          <Stack gap={8}>
            {wagon.creationApprovers.map((a, idx) => (
              <Group key={a.id} justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                  <Text fw={700} c="dimmed" w={20} ta="center">
                    {idx + 1}
                  </Text>
                  <Avatar src={a.photo || undefined} radius="xl" size={28} color="steel">
                    {a.firstName?.[0]}
                    {a.lastName?.[0]}
                  </Avatar>
                  <div style={{ minWidth: 0 }}>
                    <Group gap={5} wrap="nowrap">
                      <Text size="13px" fw={700} c="#14264f" truncate>
                        {pickName(a.role, lang)}
                      </Text>
                      {a.seh && (
                        <Badge size="xs" variant="light" color="steel" style={{ flex: "none" }}>
                          {t("wd.sehShort", { n: a.seh })}
                        </Badge>
                      )}
                    </Group>
                    <Text size="11px" c="dimmed" truncate>
                      {fio(a)}
                      {a.id === user.id && ` · ${t("wd.you")}`}
                    </Text>
                    {a.decidedAt && (
                      <Text size="10px" c="dimmed">
                        {formatDateTime(a.decidedAt)}
                        {a.decision === "denied" && a.comment
                          ? ` · ${a.comment}`
                          : ""}
                      </Text>
                    )}
                  </div>
                </Group>
                {a.decision === "denied" ? (
                  <ThemeIcon color="red" variant="light" size={24} radius="sm">
                    <IconX size={15} />
                  </ThemeIcon>
                ) : (
                  <Checkbox
                    readOnly
                    checked={a.decision === "approved"}
                    color="teal"
                    size="sm"
                  />
                )}
              </Group>
            ))}
          </Stack>

          {/* действия текущего пользователя */}
          <Group justify="flex-end" mt="md" gap="xs">
            {myCreation &&
              myCreation.decision === "pending" &&
              wagon.creationStatus === "pending" &&
              (myCreationTurn ? (
                <>
                  <Button
                    size="xs"
                    color="teal"
                    leftSection={<IconThumbUp size={14} />}
                    loading={busy === "capprove"}
                    onClick={() =>
                      patchCreation({ action: "approve" }, "capprove", t("wd.approved"))
                    }
                  >
                    {t("wd.approve")}
                  </Button>
                  <Button
                    size="xs"
                    color="red"
                    variant="light"
                    leftSection={<IconThumbDown size={14} />}
                    onClick={() => {
                      setCreationDenyOpen(true);
                      setCreationDenyComment("");
                    }}
                  >
                    {t("wd.deny")}
                  </Button>
                </>
              ) : (
                <Badge color="gray" variant="light" leftSection={<IconHourglass size={12} />}>
                  {t("wd.waitTurn")}
                </Badge>
              ))}

            {isManager && wagon.creationStatus === "rejected" && (
              <Button
                size="xs"
                color="orange"
                variant="light"
                leftSection={<IconRotateClockwise size={14} />}
                loading={busy === "creset"}
                onClick={() =>
                  patchCreation({ action: "reset" }, "creset", t("wd.resetDone"))
                }
              >
                {t("wd.reset")}
              </Button>
            )}
          </Group>
        </Card>
      )}

      {/* на телефоне отступы и маркеры меньше — иначе текст этапов не влезает */}
      <Card p={{ base: "xs", sm: "xl" }} style={{ opacity: wagonActive ? 1 : 0.55 }}>
        <Timeline
          active={activeIndex === -1 ? total : activeIndex}
          bulletSize={28}
          lineWidth={2}
          color="steel"
        >
          {wagon.stages.map((s, stageIdx) => {
            const statusColor = STATUS_COLOR[s.status];
            const plan = stagePlan[stageIdx];
            // дни позиции с датами (8 ч = 1 день); подписи привязаны к номеру дня
            const days = plan ? splitWorksIntoDays(s.works, plan.start) : [];
            const totalDays = days.length;
            const assigneeCount = s.assignees.length;
            // подпись конкретного человека за день (с решением accepted/rejected)
            const soOf = (dayIndex: number, userId: string) =>
              s.signoffs.find(
                (x) => x.dayIndex === dayIndex && x.userId === userId
              );
            const acceptedBy = (dayIndex: number, userId: string) =>
              soOf(dayIndex, userId)?.decision === "accepted";
            const dayAccepted = (dayIndex: number) =>
              assigneeCount > 0 && s.assignees.every((a) => acceptedBy(dayIndex, a.id));
            const dayRejected = (dayIndex: number) =>
              s.signoffs.some((x) => x.dayIndex === dayIndex && x.decision === "rejected");
            const acceptedDays = days.filter((d) => dayAccepted(d.index)).length;
            // день открыт для приёмки, когда предыдущий день принят полностью
            const dayActive = (dayIndex: number) =>
              dayIndex === 1 || dayAccepted(dayIndex - 1);
            // каждый принимает только за себя; управляющий за других не ставит
            const iAmAssignee = s.assignees.some((a) => a.id === user.id);
            const canSign = wagonActive && !s.locked && iAmAssignee;

            return (
              <Timeline.Item
                key={s.id}
                bullet={
                  <ThemeIcon
                    radius="xl"
                    size={36}
                    color={s.locked ? "gray" : statusColor}
                    variant={s.status === "done" || s.status === "in_progress" ? "filled" : "light"}
                  >
                    {s.status === "done" ? (
                      <IconCheck size={18} />
                    ) : s.locked ? (
                      <IconLock size={16} />
                    ) : (
                      <Text fw={700} size="sm">
                        {s.number}
                      </Text>
                    )}
                  </ThemeIcon>
                }
              >
                <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
                  <Card withBorder p="md" radius="md">
                    {/* Шапка позиции */}
                    <Group justify="space-between" wrap="wrap" gap="xs" mb={10} align="center">
                      <Group gap="xs" style={{ minWidth: 0 }}>
                        <Text size="lg" fw={600} c="#25324d" style={{ wordBreak: "break-word" }}>
                          {t("wd.stage", { number: s.number, name: pickName(s, lang) })}
                        </Text>
                        <Badge
                          size="sm"
                          radius="sm"
                          variant="light"
                          color={s.locked ? "gray" : s.status === "blocked" ? "red" : statusColor}
                        >
                          {s.locked ? t("wd.lockedBadge") : t(`sstatus.${s.status}`)}
                        </Badge>
                      </Group>
                      {totalDays > 0 && !s.locked && (
                        <Text size="sm" fw={600} c={acceptedDays === totalDays ? "teal.7" : "dimmed"}>
                          {t("wd.daysAccepted", { a: acceptedDays, t: totalDays })}
                        </Text>
                      )}
                    </Group>

                    {/* Метка: люди и общий диапазон дат — мягкими цветами, без жирного */}
                    <Group gap={7} mb="sm" wrap="wrap">
                      {(() => {
                        const n =
                          s.works.reduce((a, w) => a + (w.workerCount ?? 0), 0) ||
                          s.workerCount ||
                          0;
                        return n ? (
                          <Text size="sm" c="dimmed">
                            {t("wd.workers", { n })}
                          </Text>
                        ) : null;
                      })()}
                      {plan && (
                        <Group gap={4} wrap="nowrap">
                          <IconCalendarEvent size={13} color="var(--mantine-color-gray-5)" />
                          <Text size="sm" c="dimmed">
                            {formatDate(plan.start)}
                            {formatDate(plan.end) !== formatDate(plan.start)
                              ? ` – ${formatDate(plan.end)}`
                              : ""}
                          </Text>
                        </Group>
                      )}
                      {s.note && (
                        <Text size="sm" c="dimmed">
                          · {s.note}
                        </Text>
                      )}
                    </Group>

                    {s.locked && (
                      <Alert color="gray" variant="light" icon={<IconLock size={15} />} p="xs">
                        <Text size="xs" c="dimmed">{t("wd.lockedHint", { n: s.number - 1 })}</Text>
                      </Alert>
                    )}

                    {s.assignees.length === 0 && !s.locked && (
                      <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={15} />} p="xs">
                        <Text size="xs">{t("wd.noAssignees")}</Text>
                      </Alert>
                    )}

                    {/* Дни: слева работы, справа приёмка ответственными по очереди */}
                    {!s.locked &&
                      days.map((day) => {
                        const accepted = dayAccepted(day.index);
                        const rejected = dayRejected(day.index);
                        const active = dayActive(day.index);
                        const acceptedCount = s.assignees.filter((a) =>
                          acceptedBy(day.index, a.id)
                        ).length;
                        const tone = rejected
                          ? { bd: "red-2", bg: "red-0", ink: "red.7" }
                          : accepted
                            ? { bd: "teal-2", bg: "teal-0", ink: "teal.7" }
                            : active
                              ? { bd: "gray-3", bg: "gray-0", ink: "steel.7" }
                              : { bd: "gray-2", bg: "gray-0", ink: "gray.6" };
                        return (
                          <Box
                            key={day.index}
                            mt="sm"
                            style={{
                              border: `1px solid var(--mantine-color-${tone.bd})`,
                              borderRadius: 12,
                              overflow: "hidden",
                              opacity: active || accepted || rejected ? 1 : 0.65,
                            }}
                          >
                            {/* шапка дня */}
                            <Group
                              justify="space-between"
                              wrap="nowrap"
                              px="sm"
                              py={8}
                              style={{ background: `var(--mantine-color-${tone.bg})` }}
                            >
                              <Group gap={7} wrap="nowrap">
                                <ThemeIcon
                                  size={20}
                                  radius="sm"
                                  variant="light"
                                  color={rejected ? "red" : accepted ? "teal" : "steel"}
                                >
                                  {accepted ? (
                                    <IconCheck size={12} />
                                  ) : rejected ? (
                                    <IconX size={12} />
                                  ) : !active ? (
                                    <IconLock size={11} />
                                  ) : (
                                    <IconCalendarEvent size={12} />
                                  )}
                                </ThemeIcon>
                                <Text size="sm" fw={600} c={tone.ink}>
                                  {t("wd.day", { n: day.index })} · {formatDate(day.date)}
                                </Text>
                              </Group>
                              <Text size="13px" fw={600} c={accepted ? "teal.7" : rejected ? "red.6" : "dimmed"}>
                                {t("wd.daySignCount", { a: acceptedCount, t: assigneeCount })}
                              </Text>
                            </Group>

                            {/* тело дня — две колонки, на телефоне встают друг под друга */}
                            <Group align="stretch" gap={0} wrap="wrap">
                              {/* слева: работы дня (без часов) */}
                              <Box p="sm" style={{ flex: "1 1 220px", minWidth: 0 }}>
                                {day.portions.map((p, pi) => (
                                  <Group key={pi} gap={8} wrap="nowrap" py={3} align="flex-start">
                                    <Text size="12.5px" c="gray.5" fw={600} w={14} ta="right" mt={2}>
                                      {p.work.number}
                                    </Text>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <Text size="13.5px" c="#3a465e" lh={1.45} style={{ wordBreak: "break-word" }}>
                                        {pickName(p.work, lang)}
                                      </Text>
                                      <Group gap={8} mt={3} wrap="wrap">
                                        {p.work.seh && (
                                          <Text size="11.5px" c="steel.6" fw={600}>
                                            {t("wd.sehShort", { n: p.work.seh })}
                                          </Text>
                                        )}
                                        {!!p.work.workerCount && (
                                          <Text size="11.5px" c="gray.6">
                                            {t("wd.workers", { n: p.work.workerCount })}
                                          </Text>
                                        )}
                                      </Group>
                                    </div>
                                  </Group>
                                ))}
                              </Box>

                              {/* справа: приёмка по очереди */}
                              <Box
                                p="sm"
                                style={{
                                  flex: "1 1 250px",
                                  minWidth: 0,
                                  borderLeft: "1px solid var(--mantine-color-gray-2)",
                                  background: "var(--mantine-color-gray-0)",
                                }}
                              >
                                <Text size="11px" fw={600} c="gray.6" tt="uppercase" mb={8} style={{ letterSpacing: 0.5 }}>
                                  {t("wd.signers")}
                                </Text>
                                <Stack gap={8}>
                                  {s.assignees.map((a, ai) => {
                                    const so = soOf(day.index, a.id);
                                    const isMe = a.id === user.id;
                                    // моя очередь: все стоящие раньше уже приняли
                                    const myTurn = s.assignees
                                      .slice(0, ai)
                                      .every((x) => acceptedBy(day.index, x.id));
                                    const canActNow = canSign && isMe && active && myTurn;
                                    const busyKey = busy === `${s.id}-${day.index}`;
                                    return (
                                      <Group key={a.id} justify="space-between" wrap="nowrap" gap="xs">
                                        <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                                          <Text size="11.5px" c="gray.5" fw={600} w={12} ta="right">
                                            {ai + 1}
                                          </Text>
                                          <Avatar src={a.photo || undefined} radius="xl" size={30} color="steel">
                                            {a.firstName?.[0]}
                                            {a.lastName?.[0]}
                                          </Avatar>
                                          <div style={{ minWidth: 0 }}>
                                            <Group gap={5} wrap="nowrap">
                                              <Text size="13.5px" fw={600} c="#334063" truncate>
                                                {pickName(a.role, lang)}
                                              </Text>
                                              {a.seh && (
                                                <Text size="11.5px" c="steel.6" fw={600} style={{ flex: "none" }}>
                                                  {t("wd.sehShort", { n: a.seh })}
                                                </Text>
                                              )}
                                            </Group>
                                            <Text size="12px" c="gray.6" truncate>
                                              {fio(a)}
                                              {isMe ? ` · ${t("wd.you")}` : ""}
                                            </Text>
                                            {so?.decision === "accepted" && (
                                              <Text size="11px" c="teal.6">
                                                {formatDateTime(so.signedAt)}
                                              </Text>
                                            )}
                                            {so?.decision === "rejected" && so.comment && (
                                              <Text size="11.5px" c="red.6" lh={1.35} style={{ wordBreak: "break-word" }}>
                                                «{so.comment}»
                                              </Text>
                                            )}
                                          </div>
                                        </Group>

                                        {/* состояние / действия */}
                                        {so?.decision === "accepted" ? (
                                          canActNow ? (
                                            <Tooltip label={t("wd.unsign")} withArrow>
                                              <ActionIcon
                                                color="teal"
                                                variant="filled"
                                                radius="xl"
                                                size={26}
                                                loading={busyKey}
                                                onClick={() => signOff(s.id, day.index, "none")}
                                              >
                                                <IconCheck size={15} />
                                              </ActionIcon>
                                            </Tooltip>
                                          ) : (
                                            <ThemeIcon color="teal" variant="filled" radius="xl" size={26}>
                                              <IconCheck size={15} />
                                            </ThemeIcon>
                                          )
                                        ) : so?.decision === "rejected" ? (
                                          canActNow ? (
                                            <Button
                                              size="compact-sm"
                                              variant="light"
                                              color="teal"
                                              loading={busyKey}
                                              style={{ flex: "none" }}
                                              onClick={() => signOff(s.id, day.index, "accepted")}
                                            >
                                              {t("wd.sign")}
                                            </Button>
                                          ) : (
                                            <ThemeIcon color="red" variant="light" radius="xl" size={26}>
                                              <IconX size={14} />
                                            </ThemeIcon>
                                          )
                                        ) : canActNow ? (
                                          <Group gap={5} wrap="nowrap" style={{ flex: "none" }}>
                                            <Button
                                              size="compact-sm"
                                              variant="light"
                                              color="teal"
                                              loading={busyKey}
                                              onClick={() => signOff(s.id, day.index, "accepted")}
                                            >
                                              {t("wd.sign")}
                                            </Button>
                                            <Button
                                              size="compact-sm"
                                              variant="subtle"
                                              color="red"
                                              onClick={() =>
                                                setRejectTarget({ stageId: s.id, dayIndex: day.index })
                                              }
                                            >
                                              {t("wd.reject")}
                                            </Button>
                                          </Group>
                                        ) : isMe && active && !myTurn ? (
                                          <Text size="11px" c="gray.5" ta="right" style={{ flex: "none", maxWidth: 88 }}>
                                            {t("wd.waitTurn")}
                                          </Text>
                                        ) : (
                                          <Box
                                            style={{
                                              width: 22,
                                              height: 22,
                                              borderRadius: 99,
                                              border: "2px solid var(--mantine-color-gray-3)",
                                              flex: "none",
                                            }}
                                          />
                                        )}
                                      </Group>
                                    );
                                  })}
                                </Stack>
                              </Box>
                            </Group>
                          </Box>
                        );
                      })}

                    {/* когда позиция принята полностью */}
                    {s.status === "done" && s.finishedAt && (
                      <Group gap={6} mt="sm" wrap="nowrap">
                        <ThemeIcon color="teal" variant="light" size={20} radius="xl">
                          <IconCheck size={13} />
                        </ThemeIcon>
                        <Text size="xs" c="teal.7">
                          {t("wd.stageDone")} · {formatDate(s.finishedAt)}
                        </Text>
                      </Group>
                    )}
                  </Card>
                </motion.div>
              </Timeline.Item>
            );
          })}
        </Timeline>
      </Card>

      {/* Модалка отказа согласования создания */}
      <Modal
        opened={creationDenyOpen}
        onClose={() => setCreationDenyOpen(false)}
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
            value={creationDenyComment}
            onChange={(e) => setCreationDenyComment(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCreationDenyOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" onClick={submitCreationDeny} loading={creationDenySaving}>
              {t("wd.deny")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Модалка отказа в приёмке дня — причина обязательна */}
      <Modal
        opened={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
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
            <Button variant="default" onClick={() => setRejectTarget(null)}>
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
    </Page>
  );
}
