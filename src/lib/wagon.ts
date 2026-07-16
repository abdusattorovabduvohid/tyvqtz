// Вспомогательные функции для этапов вагона и таймеров.
// Таймер считается по серверному времени: startedAt + durationSeconds.

export interface WagonStageLike {
  status: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  durationSeconds: number;
}

// Вычисленное состояние этапа на момент времени `now` (мс).
export function computeStageState(stage: WagonStageLike, now: number) {
  const started = stage.startedAt ? stage.startedAt.getTime() : null;
  const deadline = started !== null ? started + stage.durationSeconds * 1000 : null;

  let effectiveStatus = stage.status;
  let remainingMs: number | null = null;
  let overdue = false;

  if (stage.status === "in_progress" && deadline !== null) {
    remainingMs = deadline - now;
    if (remainingMs < 0) {
      overdue = true;
      effectiveStatus = "overdue";
    }
  }

  return {
    effectiveStatus, // pending | in_progress | overdue | done
    deadline, // мс или null
    remainingMs, // оставшееся время в мс (может быть отрицательным)
    overdue,
  };
}

export interface AssignmentLike {
  decision: string; // pending | approved | denied
}

// Сводка по согласованиям этапа.
export function computeApproval(assignments: AssignmentLike[]) {
  const total = assignments.length;
  const approved = assignments.filter((a) => a.decision === "approved").length;
  const denied = assignments.filter((a) => a.decision === "denied").length;
  const allApproved = total > 0 && approved === total;
  return {
    total,
    approved,
    denied,
    allApproved,
    anyDenied: denied > 0,
  };
}

// Итоговый статус этапа с учётом согласований и таймера.
// pending | awaiting (ждёт согласований) | ready (все согласовали) |
// blocked (есть отказ) | in_progress | overdue | done
export function resolveStageStatus(
  storedStatus: string,
  assignments: AssignmentLike[],
  timerOverdue: boolean
): string {
  if (storedStatus === "done") return "done";
  if (storedStatus === "blocked") return "blocked";
  if (storedStatus === "in_progress") return timerOverdue ? "overdue" : "in_progress";
  // pending
  const ap = computeApproval(assignments);
  if (ap.anyDenied) return "blocked";
  if (ap.total === 0) return "pending"; // исполнители не назначены
  if (ap.allApproved) return "ready";
  return "awaiting"; // ждёт разрешений
}

// Общий статус вагона по его этапам.
export function computeWagonStatus(
  stages: { status: string }[]
): "pending" | "in_progress" | "done" | "blocked" {
  if (stages.length === 0) return "pending";
  if (stages.some((s) => s.status === "blocked")) return "blocked";
  const allDone = stages.every((s) => s.status === "done");
  if (allDone) return "done";
  const anyActive = stages.some(
    (s) => s.status === "in_progress" || s.status === "done"
  );
  return anyActive ? "in_progress" : "pending";
}
