"use client";

import Link from "next/link";
import { Box, Text, Group, ActionIcon, Menu, ThemeIcon } from "@mantine/core";
import {
  IconDots,
  IconTrash,
  IconArrowRight,
  IconCheck,
  IconX,
  IconCalendarEvent,
} from "@tabler/icons-react";
import { motion, useReducedMotion } from "framer-motion";
import { useI18n } from "./I18nProvider";
import { pickName } from "@/lib/i18n/translations";
import { formatDateTime, formatDate } from "@/lib/format";

export interface WagonListItem {
  id: string;
  nameRu: string;
  nameUz: string | null;
  number: string;
  wagonType: { nameRu: string; nameUz: string | null };
  status: "pending" | "in_progress" | "done" | "blocked";
  creationStatus: "pending" | "approved" | "rejected";
  progress: { done: number; total: number };
  days: { done: number; total: number };
  current: {
    number: number;
    nameRu: string | null;
    nameUz: string;
    status: string;
    note: string | null;
    workerCount: number | null;
    sehs: string[];
    plannedStart: string | null;
    plannedEnd: string | null;
  } | null;
  assignees: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    photo: string | null;
    seh: string | null;
    role: { nameRu: string; nameUz: string | null } | null;
    decision: "pending" | "approved" | "denied";
    decidedAt: string | null;
  }[];
  deniedBy: { name: string; comment: string | null } | null;
  createdAt: string;
  start: string; // «Ish boshlanish sanasi»
  deadline: string; // дата сдачи (план или вручную)
  daysLeft: number; // рабочих дней до сдачи
}

/** Тон карточки. У вагона, ждущего согласования создания, свой цвет — он ещё не в работе. */
const TONE: Record<string, { c: string; bg: string; bd: string; key: string }> = {
  creation: { c: "#b45309", bg: "#fffbeb", bd: "#fde68a", key: "wagons.awaitingCreation" },
  rejected: { c: "#dc2626", bg: "#fef2f2", bd: "#fecaca", key: "wagons.creationRejected" },
  blocked: { c: "#dc2626", bg: "#fef2f2", bd: "#fecaca", key: "wstatus.blocked" },
  in_progress: { c: "#2f66c9", bg: "#eff6ff", bd: "#bfdbfe", key: "wstatus.in_progress" },
  done: { c: "#0d9488", bg: "#f0fdfa", bd: "#99f6e4", key: "wstatus.done" },
  pending: { c: "#6b7280", bg: "#f9fafb", bd: "#e5e7eb", key: "wstatus.pending" },
};

function toneOf(w: WagonListItem) {
  if (w.creationStatus === "pending") return TONE.creation;
  if (w.creationStatus === "rejected") return TONE.rejected;
  return TONE[w.status] ?? TONE.pending;
}

/** Фамилия и инициалы — подпись мелким шрифтом под ролью. */
const fio = (a: { firstName: string; lastName: string; middleName: string | null }) =>
  [a.lastName, a.firstName?.[0] && a.firstName[0] + ".", a.middleName?.[0] && a.middleName[0] + "."]
    .filter(Boolean)
    .join(" ");

/** Галочка ответственного: разрешил / отклонил / ещё не решил. */
function DecisionMark({ decision }: { decision: "pending" | "approved" | "denied" }) {
  if (decision === "approved") {
    return (
      <ThemeIcon size={19} radius="xl" color="teal" variant="filled">
        <IconCheck size={12} stroke={3} />
      </ThemeIcon>
    );
  }
  if (decision === "denied") {
    return (
      <ThemeIcon size={19} radius="xl" color="red" variant="filled">
        <IconX size={12} stroke={3} />
      </ThemeIcon>
    );
  }
  return (
    <Box
      style={{
        width: 19,
        height: 19,
        borderRadius: 99,
        border: "2px solid var(--mantine-color-gray-3)",
        flex: "none",
      }}
    />
  );
}

/** Подпись + значение в одну колонку — из них собран низ карточки. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Text size="11px" fw={600} c="#8a93a8" style={{ letterSpacing: 0.4 }}>
        {label}
      </Text>
      <Text size="14px" fw={700} mt={3} c="#0f1e3d">
        {children}
      </Text>
    </div>
  );
}

export function WagonCard({
  w,
  index,
  canDelete,
  onDelete,
}: {
  w: WagonListItem;
  index: number;
  canDelete: boolean;
  onDelete: (w: WagonListItem) => void;
}) {
  const { t, lang } = useI18n();
  const reduce = useReducedMotion();

  const tone = toneOf(w);
  const wdLeft = w.daysLeft;
  const late = wdLeft <= 5;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4 }}
      whileHover={reduce ? undefined : { y: -3 }}
      style={{ height: "100%" }}
    >
      <Box
        style={{
          background: "#fff",
          borderRadius: 18,
          overflow: "hidden",
          border: "1px solid #e6eaf2",
          boxShadow: "0 10px 30px rgba(15,30,61,.09)",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Шапка: имя вагона на тёмном ── */}
        <Box px="lg" py="md" style={{ background: "linear-gradient(140deg,#20458a 0%,#0e2148 100%)" }}>
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
            {/* имя не режем: длинное — переносим на вторую строку */}
            <div style={{ minWidth: 0, flex: 1 }}>
              <Text fw={800} size="22px" c="#fff" lh={1.25} lineClamp={2}>
                {pickName(w, lang)}
              </Text>
              <Text size="13px" c="#9db3dd" mt={4} lineClamp={1}>
                № {w.number} · {pickName(w.wagonType, lang)}
              </Text>
            </div>
            <Group gap={4} wrap="nowrap" style={{ flex: "none" }}>
              <Box
                px={12}
                py={5}
                style={{
                  borderRadius: 8,
                  background: "rgba(255,255,255,.14)",
                  border: "1px solid rgba(255,255,255,.24)",
                  whiteSpace: "nowrap",
                }}
              >
                <Text size="11px" fw={700} c="#fff">
                  {t(tone.key)}
                </Text>
              </Box>
              {canDelete && (
                <Menu position="bottom-end" shadow="md">
                  <Menu.Target>
                    <ActionIcon variant="subtle" c="#9db3dd">
                      <IconDots size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      color="red"
                      leftSection={<IconTrash size={16} />}
                      onClick={() => onDelete(w)}
                    >
                      {t("common.delete")}
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              )}
            </Group>
          </Group>
        </Box>

        <Box p="lg" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* ── Сколько сделано ── */}
          <Group justify="space-between" align="flex-end">
            <div>
              <Text fw={800} size="30px" lh={1} c="#0f1e3d" style={{ letterSpacing: -0.8 }}>
                {w.progress.done}
                <Text span size="17px" c="#b9c2d4">
                  {" "}
                  / {w.progress.total}
                </Text>
              </Text>
              <Text size="11px" fw={600} c="#8a93a8" mt={5}>
                {t("wagons.card.stages")}
              </Text>
            </div>
            <div style={{ textAlign: "right" }}>
              <Text fw={800} size="22px" lh={1} c="#5b6b8c" style={{ letterSpacing: -0.4 }}>
                {w.days.done}
                <Text span size="14px" c="#b9c2d4">
                  {" "}
                  / {w.days.total}
                </Text>
              </Text>
              <Text size="11px" fw={600} c="#8a93a8" mt={5}>
                {t("wagons.card.days")}
              </Text>
            </div>
          </Group>

          {/* ── Где стоит, кто отвечает и кто уже согласовал ── */}
          {w.current && (
            <Box
              mt="md"
              p="sm"
              style={{ borderRadius: 12, background: tone.bg, border: `1px solid ${tone.bd}` }}
            >
              {/* название этапа — на телефоне переносится целиком, не режется */}
              <Text size="14px" fw={700} lh={1.4} c="#0f1e3d" style={{ wordBreak: "break-word" }}>
                <Text span fw={800} c={tone.c}>
                  №{w.current.number}
                </Text>{" "}
                {pickName(w.current, lang)}
              </Text>

              {/* сколько людей на позиции и в каких цехах */}
              <Group gap={6} mt={7} wrap="wrap">
                {!!w.current.workerCount && (
                  <Box px={8} py={2} style={{ borderRadius: 6, background: "#fff", border: `1px solid ${tone.bd}` }}>
                    <Text size="11px" fw={700} c={tone.c}>
                      {t("wd.workers", { n: w.current.workerCount })}
                    </Text>
                  </Box>
                )}
                {w.current.sehs.map((s) => (
                  <Box key={s} px={8} py={2} style={{ borderRadius: 6, background: "#fff", border: `1px solid ${tone.bd}` }}>
                    <Text size="11px" fw={700} c={tone.c}>
                      {t("wd.sehShort", { n: s })}
                    </Text>
                  </Box>
                ))}
                {w.current.note && (
                  <Box px={8} py={2} style={{ borderRadius: 6, background: "#fff", border: `1px solid ${tone.bd}` }}>
                    <Text size="11px" fw={700} c={tone.c}>
                      {w.current.note}
                    </Text>
                  </Box>
                )}
              </Group>

              {/* план дат текущего этапа */}
              {w.current.plannedStart && w.current.plannedEnd && (
                <Group gap={6} mt={7} wrap="nowrap">
                  <IconCalendarEvent size={14} color={tone.c} />
                  <Text size="12px" fw={600} c={tone.c}>
                    {formatDate(w.current.plannedStart)}
                    {w.current.plannedEnd !== w.current.plannedStart &&
                      ` – ${formatDate(w.current.plannedEnd)}`}
                  </Text>
                </Group>
              )}

              {w.deniedBy?.comment && (
                <Text size="12.5px" c={tone.c} mt={6} lh={1.5}>
                  «{w.deniedBy.comment}»
                </Text>
              )}

              {w.assignees.length > 0 && (
                <Box mt={10} pt={10} style={{ borderTop: `1px solid ${tone.bd}` }}>
                  {w.assignees.map((a) => {
                    // главное — роль и цех, фамилия мелко: так понятнее, кто согласует
                    const role = pickName(a.role, lang);
                    const label = a.seh ? `${role} · ${a.seh}-${t("wd.sehWord")}` : role;
                    return (
                      <Group key={a.id} gap={9} wrap="nowrap" py={4} align="flex-start">
                        <Box mt={1} style={{ flex: "none" }}>
                          <DecisionMark decision={a.decision} />
                        </Box>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text size="12.5px" fw={700} c="#0f1e3d" lh={1.35} style={{ wordBreak: "break-word" }}>
                            {label || fio(a)}
                          </Text>
                          <Text size="11px" c="#8a93a8" lh={1.35}>
                            {label ? fio(a) : ""}
                            {a.decidedAt ? `${label ? " · " : ""}${formatDateTime(a.decidedAt)}` : ""}
                          </Text>
                        </div>
                      </Group>
                    );
                  })}
                </Box>
              )}
            </Box>
          )}

          <Box style={{ flex: 1, minHeight: 16 }} />

          {/* ── Сроки: начало работ и когда должен быть готов ── */}
          <Box style={{ height: 1, background: "#eef1f7", marginBottom: 14 }} />
          {/* на узком экране даты встают друг под друга, а не сжимаются */}
          <Group justify="space-between" align="flex-start" gap="md">
            <Field label={t("wagons.startAt")}>{formatDate(w.start)}</Field>
            <div style={{ textAlign: "right" }}>
              <Text size="11px" fw={600} c="#8a93a8" style={{ letterSpacing: 0.4 }}>
                {t("wagons.deadlineAt")}
              </Text>
              <Text size="14px" fw={700} mt={3} c="#0f1e3d">
                {formatDate(w.deadline)}
              </Text>
              <Text size="12px" fw={700} mt={2} c={late ? "#dc2626" : "#0d9488"}>
                {wdLeft <= 0
                  ? t("wagons.overdueDays", { n: Math.abs(wdLeft) })
                  : t("wagons.card.leftDays", { n: wdLeft })}
              </Text>
            </div>
          </Group>

          <Box
            component={Link}
            href={`/dashboard/wagons/${w.id}`}
            mt="md"
            py={11}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              borderRadius: 10,
              background: "#0f2350",
              textDecoration: "none",
            }}
          >
            <Text size="13.5px" fw={700} c="#fff">
              {t("wagons.open")}
            </Text>
            <IconArrowRight size={16} color="#fff" />
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
}
