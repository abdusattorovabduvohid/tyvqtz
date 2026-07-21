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

// Норматив на вагон в РАБОЧИХ днях (сб/вс не считаются).
export const WAGON_WORKDAYS = 22;

// Часов в рабочем дне. Из бумажного плана: 12ч → 1,5 дня, 16ч → 2 дня.
export const HOURS_PER_DAY = 8;

// Часы → дни. ВАЖНО: считать от ОБЩИХ часов, а не складывать округлённые
// дни отдельных работ. В плане 12ч+2ч+2ч дают 1,5+0,2+0,2 = 1,9,
// а «Всего» стоит 2 — потому что это 16ч ÷ 8, а не сумма округлений.
export function hoursToDays(hours: number): number {
  return hours / HOURS_PER_DAY;
}

// «1,5» / «0,2» — один знак после запятой, без хвостовых нулей.
// Отбрасываем, а не округляем: в плане 2ч → 0,2 (не 0,3), 14ч → 1,7 (не 1,8).
export function formatDays(days: number): string {
  return String(Math.floor(days * 10) / 10);
}

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

// Кол-во прошедших рабочих дней (пн–пт) строго после даты создания и до сегодня.
export function businessDaysElapsed(
  fromISO: string | Date,
  now: Date = new Date()
): number {
  const start = typeof fromISO === "string" ? new Date(fromISO) : fromISO;
  const cur = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let count = 0;
  while (cur < end) {
    cur.setDate(cur.getDate() + 1);
    const day = cur.getDay(); // 0 = вс, 6 = сб
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

// Остаток рабочих дней (может быть отрицательным при просрочке).
export function workdaysRemaining(
  fromISO: string | Date,
  total: number = WAGON_WORKDAYS,
  now: Date = new Date()
): number {
  return total - businessDaysElapsed(fromISO, now);
}

// Крайний срок вагона: дата создания + N РАБОЧИХ дней (сб/вс не считаются).
// Время суток сохраняется: созданный в 12:18 должен быть готов к 12:18.
// Парная к workdaysRemaining — в этот день остаток обращается в ноль.
export function wagonDeadline(
  fromISO: string | Date,
  total: number = WAGON_WORKDAYS
): Date {
  const d = new Date(fromISO); // копия — исходную дату не трогаем
  let added = 0;
  while (added < total) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay(); // 0 = вс, 6 = сб
    if (day !== 0 && day !== 6) added += 1;
  }
  return d;
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
