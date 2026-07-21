// Сбор данных для главной страницы: что требует внимания, кто что делал,
// где сейчас каждый вагон. Всё считается из одного запроса к вагонам.

import { computeWagonStatus, computeStageState } from "./wagon";
import { wagonSchedule, businessDaysUntil } from "./format";

// Порог «скоро дедлайн» — рабочих дней из нормы на вагон.
export const DEADLINE_WARN_DAYS = 5;

export interface WagonRef {
  id: string;
  nameRu: string;
  nameUz: string | null;
  number: string;
}
export interface StageRef {
  number: number;
  nameRu: string;
  nameUz: string | null;
}

export interface AttentionItem {
  kind: "blocked" | "deadline" | "creation";
  wagon: WagonRef;
  stage?: StageRef;
  by?: string; // кто отклонил
  comment?: string | null;
  daysLeft?: number;
}

export interface ActivityItem {
  kind: "start" | "finish" | "deny";
  at: string; // ISO
  by: string;
  wagon: WagonRef;
  stage: StageRef;
  comment?: string | null;
}

export interface ActiveWagonRow {
  wagon: WagonRef;
  type: { nameRu: string; nameUz: string | null };
  done: number;
  total: number;
  status: "pending" | "in_progress" | "done" | "blocked";
  creationPending: boolean;
  current: (StageRef & { status: string }) | null;
}

export interface WagonCounts {
  done: number;
  in_progress: number;
  pending: number;
  blocked: number;
  total: number;
}

// Форма строки из prisma-запроса (см. dashboard/page.tsx).
interface UserLike {
  firstName: string;
  lastName: string;
  middleName: string | null;
}
interface AssignmentLike {
  decision: string;
  comment: string | null;
  decidedAt: Date | null;
  user: UserLike;
}
interface StageLike {
  number: number;
  nameRu: string | null;
  nameUz: string;
  status: string;
  durationSeconds: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  startedBy: UserLike | null;
  finishedBy: UserLike | null;
  assignments: AssignmentLike[];
}
export interface WagonLike {
  id: string;
  nameRu: string | null;
  nameUz: string;
  number: string;
  creationStatus: string;
  createdAt: Date;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  wagonType: { nameRu: string | null; nameUz: string };
  stages: StageLike[];
}

const fio = (u: UserLike) =>
  [u.lastName, u.firstName, u.middleName].filter(Boolean).join(" ");

// nameRu в базе nullable, а в UI ждут string — приводим здесь один раз.
const refOf = (w: WagonLike): WagonRef => ({
  id: w.id,
  nameRu: w.nameRu ?? "",
  nameUz: w.nameUz,
  number: w.number,
});
const stageRefOf = (s: StageLike): StageRef => ({
  number: s.number,
  nameRu: s.nameRu ?? "",
  nameUz: s.nameUz,
});

export function buildCounts(wagons: WagonLike[]): WagonCounts {
  const c: WagonCounts = { done: 0, in_progress: 0, pending: 0, blocked: 0, total: 0 };
  for (const w of wagons) {
    c[computeWagonStatus(w.stages)] += 1;
    c.total += 1;
  }
  return c;
}

// Что требует вмешательства: остановленные, горящие по сроку, ждущие согласования.
export function buildAttention(wagons: WagonLike[], now = Date.now()): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const w of wagons) {
    if (w.creationStatus === "pending") {
      items.push({ kind: "creation", wagon: refOf(w) });
      continue; // вагон ещё не запущен — остальное про него неактуально
    }
    if (w.creationStatus === "rejected") continue;

    const blocked = w.stages.find((s) => s.status === "blocked");
    if (blocked) {
      const denier = blocked.assignments.find((a) => a.decision === "denied");
      items.push({
        kind: "blocked",
        wagon: refOf(w),
        stage: stageRefOf(blocked),
        by: denier ? fio(denier.user) : undefined,
        comment: denier?.comment ?? null,
      });
    }

    // просроченный по таймеру этап — тоже требует внимания
    for (const s of w.stages) {
      if (s.status !== "in_progress") continue;
      if (computeStageState(s, now).overdue) {
        items.push({ kind: "blocked", wagon: refOf(w), stage: stageRefOf(s) });
      }
    }

    const allDone = w.stages.length > 0 && w.stages.every((s) => s.status === "done");
    if (allDone) continue;
    // срок = ручная дата сдачи или конец плана этапов
    const { end } = wagonSchedule(
      w.plannedStart ?? w.createdAt,
      w.stages.map((s) => s.durationSeconds)
    );
    const daysLeft = businessDaysUntil(w.plannedEnd ?? end, new Date(now));
    if (daysLeft <= DEADLINE_WARN_DAYS) {
      items.push({ kind: "deadline", wagon: refOf(w), daysLeft });
    }
  }

  // остановленные — выше всех, затем самые горящие по сроку
  const rank = { blocked: 0, deadline: 1, creation: 2 };
  return items.sort(
    (a, b) => rank[a.kind] - rank[b.kind] || (a.daysLeft ?? 0) - (b.daysLeft ?? 0)
  );
}

// Лента: кто запускал, завершал и отклонял этапы.
export function buildActivity(wagons: WagonLike[], limit = 6): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const w of wagons) {
    const wagon = refOf(w);
    for (const s of w.stages) {
      const stage = stageRefOf(s);
      // у этапов, запущенных до появления startedBy, автора нет — их пропускаем
      if (s.startedAt && s.startedBy) {
        items.push({
          kind: "start",
          at: s.startedAt.toISOString(),
          by: fio(s.startedBy),
          wagon,
          stage,
        });
      }
      if (s.finishedAt && s.finishedBy) {
        items.push({
          kind: "finish",
          at: s.finishedAt.toISOString(),
          by: fio(s.finishedBy),
          wagon,
          stage,
        });
      }
      for (const a of s.assignments) {
        if (a.decision === "denied" && a.decidedAt) {
          items.push({
            kind: "deny",
            at: a.decidedAt.toISOString(),
            by: fio(a.user),
            wagon,
            stage,
            comment: a.comment,
          });
        }
      }
    }
  }

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

// Где сейчас каждый вагон: прогресс и текущий этап.
export function buildActiveWagons(wagons: WagonLike[]): ActiveWagonRow[] {
  return wagons.map((w) => {
    const total = w.stages.length;
    const done = w.stages.filter((s) => s.status === "done").length;
    // показываем то, на чём вагон реально стоит
    const current =
      w.stages.find((s) => s.status === "blocked") ??
      w.stages.find((s) => s.status === "in_progress") ??
      w.stages.find((s) => s.status !== "done") ??
      null;
    return {
      wagon: refOf(w),
      type: { nameRu: w.wagonType.nameRu ?? "", nameUz: w.wagonType.nameUz },
      done,
      total,
      status: computeWagonStatus(w.stages),
      creationPending: w.creationStatus === "pending",
      current: current ? { ...stageRefOf(current), status: current.status } : null,
    };
  });
}
