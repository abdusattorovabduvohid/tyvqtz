import { translate, type Lang, DEFAULT_LANG } from "./i18n/translations";

// Человекочитаемая длительность из секунд: "1 ч 30 мин" / "1 soat 30 daqiqa".
export function formatDuration(
  totalSeconds: number,
  lang: Lang = DEFAULT_LANG
): string {
  if (totalSeconds <= 0) return translate(lang, "dur.zero");
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} ${translate(lang, "dur.h")}`);
  if (m) parts.push(`${m} ${translate(lang, "dur.m")}`);
  if (s) parts.push(`${s} ${translate(lang, "dur.s")}`);
  return parts.join(" ");
}

// Часов в рабочем дне (08:00–17:00). На нём держится расчёт дней.
export const HOURS_PER_DAY = 8;

// Дата в формате ДД.ММ.ГГГГ.
export function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// Дата и время в формате ДД.ММ.ГГГГ ЧЧ:ММ.
export function formatDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}


// ─── Календарный план этапов ───
// Этапы идут последовательно, один за другим. Выходные (сб/вс) пропускаются:
// если старт выпадает на выходной — переносится на понедельник.

function isWeekend(d: Date): boolean {
  const g = d.getDay(); // 0 = вс, 6 = сб
  return g === 0 || g === 6;
}

// Ближайший рабочий день В ЭТОТ день или позже.
export function firstWorkday(from: string | Date): Date {
  const d = new Date(from);
  while (isWeekend(d)) d.setDate(d.getDate() + 1);
  return d;
}

// Следующий рабочий день строго ПОСЛЕ d.
function nextWorkday(d: Date): Date {
  const r = new Date(d);
  do {
    r.setDate(r.getDate() + 1);
  } while (isWeekend(r));
  return r;
}

// Сколько рабочих дней занимает этап: целое число, минимум 1.
// 8 ч = 1 день, 16 ч = 2 дня, 1–7 ч тоже занимают отдельный день.
export function stageWorkdays(durationSeconds: number): number {
  return Math.max(1, Math.ceil(durationSeconds / 3600 / HOURS_PER_DAY));
}

export interface StagePlan {
  start: Date;
  end: Date;
  days: number;
}

// Рабочих дней от сегодня до даты `to`. Отрицательное — если срок в прошлом.
export function businessDaysUntil(to: string | Date, now: Date = new Date()): number {
  const end = new Date(to);
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const [lo, hi, sign] = b >= a ? [a, b, 1] : [b, a, -1];
  const cur = new Date(lo);
  let count = 0;
  while (cur < hi) {
    cur.setDate(cur.getDate() + 1);
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count += 1;
  }
  return sign * count;
}

// План дат для цепочки этапов: этап N начинается на следующий рабочий день
// после конца этапа N-1. Первый — с даты создания вагона (или ближайшего
// рабочего дня). durationsSeconds — в порядке номеров этапов.
export function scheduleStages(
  createdAt: string | Date,
  durationsSeconds: number[]
): StagePlan[] {
  const out: StagePlan[] = [];
  let cursor = firstWorkday(createdAt);
  for (const sec of durationsSeconds) {
    const days = stageWorkdays(sec);
    const start = new Date(cursor);
    let end = new Date(start);
    for (let i = 1; i < days; i++) end = nextWorkday(end);
    out.push({ start, end, days });
    cursor = nextWorkday(end);
  }
  return out;
}

// Сводка по вагону: план дат, дата окончания и всего рабочих дней.
// start — «Ish boshlanish sanasi» (или дата создания, если не задана).
export function wagonSchedule(
  start: string | Date,
  durationsSeconds: number[]
): { plan: StagePlan[]; end: Date; totalDays: number } {
  const plan = scheduleStages(start, durationsSeconds);
  const end = plan.length ? plan[plan.length - 1].end : firstWorkday(start);
  const totalDays = durationsSeconds.reduce((a, s) => a + stageWorkdays(s), 0);
  return { plan, end, totalDays };
}

// ─── Разбивка работ позиции по рабочим дням ───
// Рабочий день = 8 часов (08:00–17:00). Работы идут ПОСЛЕДОВАТЕЛЬНО: копим
// часы, каждые 8 ч закрывают день и получают свою дату (сб/вс пропускаются).
// Если работа не помещается в остаток дня — её «хвост» переносится на
// следующий день (строгие 8 ч в дне). Пример: 3 ч + 5 ч = 8 ч = один день.

export interface WorkDayPortion<T> {
  work: T;
  hours: number; // сколько часов этой работы делается в этот день
  total: number; // всего часов у работы — для подписи «2 / 8 ч»
  partial: boolean; // работа разбита между днями
}
export interface WorkDay<T> {
  index: number; // номер дня внутри позиции, с 1
  date: Date;
  hours: number; // часов за день (обычно 8, последний — остаток)
  portions: WorkDayPortion<T>[];
}

export function splitWorksIntoDays<T extends { hours: number }>(
  works: T[],
  start: string | Date
): WorkDay<T>[] {
  const CAP = HOURS_PER_DAY;
  const days: WorkDay<T>[] = [];
  let cur: WorkDay<T> | null = null;

  const openDay = () => {
    const date = days.length
      ? nextWorkday(days[days.length - 1].date)
      : firstWorkday(start);
    cur = { index: days.length + 1, date, hours: 0, portions: [] };
  };

  for (const w of works) {
    let remaining = w.hours;
    if (remaining <= 0) continue;
    while (remaining > 0) {
      if (!cur) openDay();
      const day = cur!;
      const take = Math.min(CAP - day.hours, remaining);
      day.portions.push({
        work: w,
        hours: take,
        total: w.hours,
        partial: take < w.hours,
      });
      day.hours += take;
      remaining -= take;
      if (day.hours >= CAP) {
        days.push(day);
        cur = null;
      }
    }
  }
  if (cur) days.push(cur);
  return days;
}

// Обратный отсчёт из миллисекунд: "01:23:45" или "23:45".
export function formatCountdown(ms: number): string {
  const neg = ms < 0;
  const total = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const body =
    h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return neg ? `-${body}` : body;
}
