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
  Divider,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowLeft,
  IconPlayerPlay,
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
import { Countdown } from "@/components/Countdown";
import { useUser, useCan } from "@/components/UserContext";
import { useI18n } from "@/components/I18nProvider";
import { pickName } from "@/lib/i18n/translations";
import {
  formatDuration,
  formatDate,
  formatDateTime,
  businessDaysUntil,
  wagonSchedule,
} from "@/lib/format";

interface Assignee {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  photo: string | null;
  seh: string | null;
  role: { nameRu: string; nameUz: string | null };
  decision: "pending" | "approved" | "denied";
  comment: string | null;
  decidedAt: string | null;
  // жмёт ли этот человек «Старт» / «Завершить» (разрешение дают все, кнопки — эти)
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
interface Stage {
  id: string;
  number: number;
  nameRu: string;
  nameUz: string | null;
  durationSeconds: number;
  workerCount: number | null;
  note: string | null;
  works: StageWork[];
  status: "pending" | "awaiting" | "ready" | "blocked" | "in_progress" | "overdue" | "done";
  startedAt: string | null;
  startedBy: { firstName: string; lastName: string; middleName: string | null } | null;
  finishedAt: string | null;
  finishedBy: { firstName: string; lastName: string; middleName: string | null } | null;
  finishComment: string | null;
  deadline: number | null;
  approval: { total: number; approved: number; denied: number; allApproved: boolean };
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

  // отказ (этап)
  const [denyStage, setDenyStage] = useState<Stage | null>(null);
  const [denyComment, setDenyComment] = useState("");
  // завершение требует причину отклонения от норматива
  const [finishStage, setFinishStage] = useState<Stage | null>(null);
  const [finishComment, setFinishComment] = useState("");
  const [finishSaving, setFinishSaving] = useState(false);
  const [denySaving, setDenySaving] = useState(false);

  // отказ (создание вагона)
  const [creationDenyOpen, setCreationDenyOpen] = useState(false);
  const [creationDenyComment, setCreationDenyComment] = useState("");
  const [creationDenySaving, setCreationDenySaving] = useState(false);

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
            const prevDone =
              s.number === 1 ||
              wagon.stages.find((x) => x.number === s.number - 1)?.status === "done";
            const myIndex = s.assignees.findIndex((a) => a.id === user.id);
            const mine = myIndex >= 0 ? s.assignees[myIndex] : undefined;
            const isAssignee = Boolean(mine);
            // Разрешение дают все назначенные, а «Старт»/«Завершить» — только
            // отмеченные canExecute. Управляющий — как запасной вариант.
            // Действия доступны только после активации вагона.
            const canAct = wagonActive && (isManager || Boolean(mine?.canExecute));
            const running = s.status === "in_progress" || s.status === "overdue";
            const deniers = s.assignees.filter((a) => a.decision === "denied");
            // моя очередь: все стоящие раньше меня уже одобрили
            const myTurn =
              myIndex >= 0 &&
              s.assignees.slice(0, myIndex).every((a) => a.decision === "approved");

            return (
              <Timeline.Item
                key={s.id}
                bullet={
                  <ThemeIcon
                    radius="xl"
                    size={36}
                    color={statusColor}
                    variant={s.status === "pending" || s.status === "awaiting" ? "light" : "filled"}
                  >
                    {s.status === "done" ? (
                      <IconCheck size={18} />
                    ) : s.status === "blocked" ? (
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
                    {/* колонки шире 260px не сжимаются, а переносятся — на телефоне встают друг под друга */}
                    <Group justify="space-between" wrap="wrap" gap="sm" align="flex-start">
                      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                        <Group gap="xs" mb={4}>
                          <Text fw={700}>
                            {t("wd.stage", {
                              number: s.number,
                              name: pickName(s, lang),
                            })}
                          </Text>
                          <Badge size="sm" variant="light" color={statusColor}>
                            {t(`sstatus.${s.status}`)}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed">
                          {t("wd.norm", {
                            dur: formatDuration(s.durationSeconds, lang),
                          })}
                          {/* людей на позиции — сумма по работам: они идут параллельно по цехам */}
                          {(() => {
                            const n =
                              s.works.reduce((a, w) => a + (w.workerCount ?? 0), 0) ||
                              s.workerCount ||
                              0;
                            return n ? ` · ${t("wd.workers", { n })}` : "";
                          })()}
                          {s.note ? ` · ${s.note}` : ""}
                          {s.approval.total > 0 &&
                            ` · ${t("wd.approvals", {
                              a: s.approval.approved,
                              t: s.approval.total,
                            })}`}
                        </Text>

                        {/* План: когда этап должен идти по календарю */}
                        {plan && (
                          <Group gap={5} mt={4} wrap="nowrap">
                            <IconCalendarEvent size={13} color="var(--mantine-color-steel-6)" />
                            <Text size="xs" c="steel.7" fw={600}>
                              {t("wd.plan")}:{" "}
                              {formatDate(plan.start)}
                              {formatDate(plan.end) !== formatDate(plan.start) &&
                                ` – ${formatDate(plan.end)}`}
                            </Text>
                          </Group>
                        )}

                        {/* Работы позиции — из чего складывается её время */}
                        {s.works.length > 0 && (
                          <Box
                            mt="xs"
                            p="xs"
                            style={{
                              borderRadius: 8,
                              background: "var(--mantine-color-gray-0)",
                            }}
                          >
                            {/* на телефоне значки уходят под название, а не сжимают его */}
                            {s.works.map((w) => (
                              <Group key={w.id} gap={8} wrap="nowrap" py={4} align="flex-start">
                                <Text size="10px" c="dimmed" fw={700} w={12} ta="right" mt={2}>
                                  {w.number}
                                </Text>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <Text size="xs" lh={1.4} style={{ wordBreak: "break-word" }}>
                                    {pickName(w, lang)}
                                  </Text>
                                  <Group gap={6} mt={4} wrap="wrap">
                                    {w.seh && (
                                      <Badge size="xs" variant="light" color="steel">
                                        {t("wd.sehShort", { n: w.seh })}
                                      </Badge>
                                    )}
                                    {!!w.workerCount && (
                                      <Badge size="xs" variant="light" color="indigo">
                                        {t("wd.workers", { n: w.workerCount })}
                                      </Badge>
                                    )}
                                    <Badge size="xs" variant="light" color="gray">
                                      {t("wd.workHours", { h: w.hours })}
                                    </Badge>
                                  </Group>
                                </div>
                              </Group>
                            ))}
                          </Box>
                        )}

                        {/* Кто и когда запустил этап */}
                        {s.startedBy && s.startedAt && (
                          <Group gap={6} mt="xs" wrap="nowrap">
                            <ThemeIcon color="blue" variant="light" size={20} radius="xl">
                              <IconPlayerPlay size={13} />
                            </ThemeIcon>
                            <Text size="xs" c="dimmed">
                              {t("wd.startedBy")}:{" "}
                              <Text span fw={600} c="dark">
                                {fio(s.startedBy)}
                              </Text>{" "}
                              · {formatDateTime(s.startedAt)}
                            </Text>
                          </Group>
                        )}

                        {/* Кто и когда завершил этап */}
                        {s.status === "done" && s.finishedBy && s.finishedAt && (
                          <Group gap={6} mt="xs" wrap="nowrap">
                            <ThemeIcon color="teal" variant="light" size={20} radius="xl">
                              <IconCheck size={13} />
                            </ThemeIcon>
                            <Text size="xs" c="dimmed">
                              {t("wd.finishedBy")}:{" "}
                              <Text span fw={600} c="dark">
                                {fio(s.finishedBy)}
                              </Text>{" "}
                              · {formatDateTime(s.finishedAt)}
                            </Text>
                          </Group>
                        )}

                        {/* Отклонение от норматива: план vs факт + причина */}
                        {s.status === "done" &&
                          s.finishedAt &&
                          s.deadline &&
                          (() => {
                            const late =
                              new Date(s.finishedAt).getTime() > s.deadline;
                            return (
                              <Alert
                                mt="xs"
                                variant="light"
                                color={late ? "red" : "teal"}
                                icon={<IconCalendarClock size={15} />}
                                title={late ? t("wd.finishLate") : t("wd.finishEarly")}
                              >
                                <Text size="xs">
                                  {t("wd.finishPlanned")}:{" "}
                                  <Text span fw={600}>
                                    {formatDateTime(new Date(s.deadline))}
                                  </Text>
                                  {" · "}
                                  {t("wd.finishFact")}:{" "}
                                  <Text span fw={700} c={late ? "red" : "teal"}>
                                    {formatDateTime(s.finishedAt)}
                                  </Text>
                                </Text>
                                {s.finishComment && (
                                  <Text size="xs" mt={4}>
                                    {t("wd.finishWhy")}: «{s.finishComment}»
                                  </Text>
                                )}
                              </Alert>
                            );
                          })()}

                        {/* Причина блокировки */}
                        {s.status === "blocked" && deniers.length > 0 && (
                          <Alert
                            color="red"
                            variant="light"
                            mt="sm"
                            icon={<IconAlertTriangle size={16} />}
                            title={t("wd.blockedTitle")}
                          >
                            {deniers.map((d) => (
                              <Text key={d.id} size="xs">
                                <b>{fio(d)}:</b> {d.comment}
                                {d.decidedAt && (
                                  <Text span c="dimmed">
                                    {" "}
                                    · {formatDateTime(d.decidedAt)}
                                  </Text>
                                )}
                              </Text>
                            ))}
                          </Alert>
                        )}
                      </div>

                      {/* Правая колонка: ответственные + таймер + действия */}
                      <Stack gap="sm" align="stretch" style={{ flex: "1 1 240px", minWidth: 0 }}>
                        {/* Ответственные и чекбоксы разрешений */}
                        {s.assignees.length === 0 ? (
                          <Text size="xs" c="dimmed" ta="right">
                            {t("wd.noAssignees")}
                          </Text>
                        ) : (
                          <Stack gap={8}>
                            {s.assignees.map((a, ai) => (
                              <Group
                                key={a.id}
                                justify="space-between"
                                wrap="nowrap"
                                gap="sm"
                              >
                                <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                                  <Text size="xs" c="dimmed" fw={700} w={14} ta="right">
                                    {ai + 1}
                                  </Text>
                                  <Avatar
                                    src={a.photo || undefined}
                                    radius="xl"
                                    size={26}
                                    color="steel"
                                  >
                                    {a.firstName?.[0]}
                                    {a.lastName?.[0]}
                                  </Avatar>
                                  <div style={{ minWidth: 0 }}>
                                    {/* роль и цех — крупно, они важнее имени */}
                                    <Group gap={5} wrap="nowrap">
                                      <Text size="13px" fw={700} c="#14264f" truncate>
                                        {pickName(a.role, lang)}
                                      </Text>
                                      {a.seh && (
                                        <Badge size="xs" variant="light" color="steel" style={{ flex: "none" }}>
                                          {t("wd.sehShort", { n: a.seh })}
                                        </Badge>
                                      )}
                                      {a.canExecute && (
                                        <Tooltip label={t("wd.executorHint")} withArrow>
                                          <ThemeIcon color="blue" variant="light" size={16} radius="xl">
                                            <IconPlayerPlay size={9} />
                                          </ThemeIcon>
                                        </Tooltip>
                                      )}
                                    </Group>
                                    <Text size="11px" c="dimmed" truncate>
                                      {fio(a)}
                                      {a.id === user.id && ` · ${t("wd.you")}`}
                                    </Text>
                                    {a.decidedAt &&
                                      (a.decision === "approved" ||
                                        a.decision === "denied") && (
                                        <Text
                                          size="10px"
                                          c={a.decision === "denied" ? "red" : "teal"}
                                          lh={1.15}
                                        >
                                          {formatDateTime(a.decidedAt)}
                                        </Text>
                                      )}
                                  </div>
                                </Group>
                                <Tooltip
                                  label={a.comment || t(`decision.${a.decision}`)}
                                  withArrow
                                >
                                  {a.decision === "denied" ? (
                                    <ThemeIcon
                                      color="red"
                                      variant="light"
                                      size={24}
                                      radius="sm"
                                    >
                                      <IconX size={15} />
                                    </ThemeIcon>
                                  ) : (
                                    <Checkbox
                                      readOnly
                                      checked={a.decision === "approved"}
                                      color="teal"
                                      size="sm"
                                      aria-label={t(`decision.${a.decision}`)}
                                    />
                                  )}
                                </Tooltip>
                              </Group>
                            ))}
                          </Stack>
                        )}

                        {(running || s.assignees.length > 0) && <Divider />}

                        {running && s.deadline && (
                          <Countdown
                            deadline={s.deadline}
                            durationSeconds={s.durationSeconds}
                            clockOffset={clockOffset.current}
                          />
                        )}

                        <Group gap="xs" justify="flex-end">
                          {/* Согласование (назначенный, пока ждём разрешений) */}
                          {wagonActive &&
                            isAssignee &&
                            mine?.decision === "pending" &&
                            s.status === "awaiting" && (
                              <>
                                {myTurn ? (
                                  <Button
                                    size="xs"
                                    color="teal"
                                    leftSection={<IconThumbUp size={14} />}
                                    loading={busy === s.id + "approve"}
                                    onClick={() =>
                                      patch(
                                        s.id,
                                        { action: "approve" },
                                        s.id + "approve",
                                        t("wd.approved")
                                      )
                                    }
                                  >
                                    {t("wd.approve")}
                                  </Button>
                                ) : (
                                  <Badge
                                    color="gray"
                                    variant="light"
                                    leftSection={<IconHourglass size={12} />}
                                  >
                                    {t("wd.waitTurn")}
                                  </Badge>
                                )}
                                <Button
                                  size="xs"
                                  color="red"
                                  variant="light"
                                  leftSection={<IconThumbDown size={14} />}
                                  onClick={() => {
                                    setDenyStage(s);
                                    setDenyComment("");
                                  }}
                                >
                                  {t("wd.deny")}
                                </Button>
                              </>
                            )}

                          {/* Старт (все разрешения получены) */}
                          {canAct && s.status === "ready" && prevDone && (
                            <Button
                              size="xs"
                              color="blue"
                              leftSection={<IconPlayerPlay size={14} />}
                              loading={busy === s.id + "start"}
                              onClick={() =>
                                patch(s.id, { action: "start" }, s.id + "start", t("wd.started"))
                              }
                            >
                              {t("wd.start")}
                            </Button>
                          )}
                          {canAct && s.status === "ready" && !prevDone && (
                            <Badge color="gray" variant="light">
                              {t("wd.waitingPrev", { n: s.number - 1 })}
                            </Badge>
                          )}

                          {/* Завершение — через окно с причиной */}
                          {canAct && running && (
                            <Button
                              size="xs"
                              color="teal"
                              leftSection={<IconCheck size={14} />}
                              loading={busy === s.id + "finish"}
                              onClick={() => {
                                setFinishStage(s);
                                setFinishComment("");
                              }}
                            >
                              {t("wd.finish")}
                            </Button>
                          )}

                          {/* Сброс блокировки (управляющий) */}
                          {wagonActive && isManager && s.status === "blocked" && (
                            <Button
                              size="xs"
                              color="orange"
                              variant="light"
                              leftSection={<IconRotateClockwise size={14} />}
                              loading={busy === s.id + "reset"}
                              onClick={() =>
                                patch(
                                  s.id,
                                  { action: "reset" },
                                  s.id + "reset",
                                  t("wd.resetDone")
                                )
                              }
                            >
                              {t("wd.reset")}
                            </Button>
                          )}
                        </Group>
                      </Stack>
                    </Group>
                  </Card>
                </motion.div>
              </Timeline.Item>
            );
          })}
        </Timeline>
      </Card>

      {/* Модалка отказа */}
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
              {t("wd.deny")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Модалка завершения — обязательна причина отклонения от норматива */}
      <Modal
        opened={!!finishStage}
        onClose={() => setFinishStage(null)}
        title={finishStage ? t("wd.finishTitle", { number: finishStage.number }) : ""}
      >
        <Stack>
          {finishStage &&
            (() => {
              // просрочено или раньше срока — сравниваем план с текущим моментом
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
              {t("wd.finish")}
            </Button>
          </Group>
        </Stack>
      </Modal>

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
    </Page>
  );
}
