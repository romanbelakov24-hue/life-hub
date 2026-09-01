/**
 * Работа с датами.
 *
 * Договорённость по всему проекту: дата хранится и передаётся строкой
 * `YYYY-MM-DD` в ЛОКАЛЬНОМ времени пользователя. Объект Date создаётся только
 * для вычислений и всегда через `fromIso`, который ставит полночь по локали —
 * иначе `new Date("2026-09-01")` распарсится как UTC и в РФ съедет на день назад.
 */

import type { IsoDate, Weekday } from "@/lib/types";

export const WEEKDAY_NAMES: Record<Weekday, string> = {
  1: "Понедельник",
  2: "Вторник",
  3: "Среда",
  4: "Четверг",
  5: "Пятница",
  6: "Суббота",
  7: "Воскресенье",
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  1: "Пн",
  2: "Вт",
  3: "Ср",
  4: "Чт",
  5: "Пт",
  6: "Сб",
  7: "Вс",
};

const MONTHS_NOMINATIVE = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const MONTHS_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

// ─── Преобразования ──────────────────────────────────────────────────────────

/** Date -> `YYYY-MM-DD` в локальной таймзоне. */
export function toIso(date: Date): IsoDate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** `YYYY-MM-DD` -> Date (локальная полночь). */
export function fromIso(iso: IsoDate): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

/** Сегодняшняя дата в формате `YYYY-MM-DD`. */
export function todayIso(): IsoDate {
  return toIso(new Date());
}

/** Проверка корректности строки даты. */
export function isValidIso(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(fromIso(value).getTime());
}

// ─── Арифметика ──────────────────────────────────────────────────────────────

export function addDays(iso: IsoDate, days: number): IsoDate {
  const date = fromIso(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

export function addMonths(iso: IsoDate, months: number): IsoDate {
  const date = fromIso(iso);
  const targetDay = date.getDate();

  // Сначала переводим на 1-е число, иначе 31 января + 1 месяц даст 3 марта.
  date.setDate(1);
  date.setMonth(date.getMonth() + months);

  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(targetDay, lastDay));

  return toIso(date);
}

/** Количество дней между датами (b - a). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / msPerDay);
}

// ─── Границы периодов ────────────────────────────────────────────────────────

/** Понедельник недели, в которую попадает дата. */
export function startOfWeek(iso: IsoDate): IsoDate {
  const date = fromIso(iso);
  const shift = (date.getDay() + 6) % 7; // getDay(): 0 = воскресенье
  date.setDate(date.getDate() - shift);
  return toIso(date);
}

export function endOfWeek(iso: IsoDate): IsoDate {
  return addDays(startOfWeek(iso), 6);
}

export function startOfMonth(iso: IsoDate): IsoDate {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonth(iso: IsoDate): IsoDate {
  const date = fromIso(iso);
  return toIso(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

/** Все даты месяца — нужны для графика по дням без пропусков. */
export function daysOfMonth(iso: IsoDate): IsoDate[] {
  const first = startOfMonth(iso);
  const total = fromIso(endOfMonth(iso)).getDate();
  return Array.from({ length: total }, (_, index) => addDays(first, index));
}

/** День недели по ISO-8601: 1 (пн) … 7 (вс). */
export function weekdayOf(iso: IsoDate): Weekday {
  const day = fromIso(iso).getDay();
  return (day === 0 ? 7 : day) as Weekday;
}

// ─── Отображение ─────────────────────────────────────────────────────────────

/** `2026-09-01` -> "Сентябрь 2026" */
export function formatMonthTitle(iso: IsoDate): string {
  const date = fromIso(iso);
  return `${MONTHS_NOMINATIVE[date.getMonth()]} ${date.getFullYear()}`;
}

/** `2026-09` -> "Сен 26" — компактная подпись для сравнения месяцев. */
export function formatMonthShort(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const name = MONTHS_SHORT[(month ?? 1) - 1] ?? "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${String(year).slice(2)}`;
}

/** `2026-09-01` -> "1 сентября" */
export function formatDayMonth(iso: IsoDate): string {
  const date = fromIso(iso);
  return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
}

/** `2026-09-01` -> "1 сен" — для плотных таблиц и осей графиков. */
export function formatDayMonthShort(iso: IsoDate): string {
  const date = fromIso(iso);
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** "Сегодня" / "Вчера" / "1 сентября" — человеческая подпись даты. */
export function formatRelativeDay(iso: IsoDate, reference: IsoDate): string {
  const diff = daysBetween(reference, iso);
  if (diff === 0) return "Сегодня";
  if (diff === -1) return "Вчера";
  if (diff === 1) return "Завтра";
  return formatDayMonth(iso);
}

/** Подпись дедлайна задачи. */
export function formatDeadline(iso: IsoDate, reference: IsoDate): string {
  const diff = daysBetween(reference, iso);
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Завтра";
  if (diff === -1) return "Вчера";
  if (diff < 0) return `Просрочено: ${formatDayMonthShort(iso)}`;
  return formatDayMonthShort(iso);
}

/** `2026-09-01` -> `2026-09` */
export function monthKeyOf(iso: IsoDate): string {
  return iso.slice(0, 7);
}

/** Ключ ISO-недели: `2026-W36`. Используется для группировки трендов. */
export function weekKeyOf(iso: IsoDate): string {
  const date = fromIso(iso);

  // Алгоритм ISO-8601: год недели определяется её четвергом.
  const thursday = new Date(date);
  thursday.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));

  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const weekNumber =
    1 +
    Math.round(
      ((thursday.getTime() - firstThursday.getTime()) / 86_400_000 -
        3 +
        ((firstThursday.getDay() + 6) % 7)) /
        7,
    );

  return `${thursday.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

/** `2026-W36` -> "нед. 36" */
export function formatWeekKey(key: string): string {
  return `нед. ${key.slice(-2).replace(/^0/, "")}`;
}
