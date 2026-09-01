/**
 * Настройки сетки расписания.
 * Другое расписание звонков или шестидневка вместо пятидневки? Правится здесь,
 * компоненты подстроятся автоматически.
 */

import type { Weekday } from "@/lib/types";

/** Учебные дни в сетке. Убери 6, если суббота свободна. */
export const SCHEDULE_WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6];

/** Максимальное количество пар в дне. */
export const PAIRS_PER_DAY = 7;

/** Расписание звонков по умолчанию (можно переопределить в каждой ячейке). */
export const DEFAULT_PAIR_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: "08:30", end: "10:00" },
  2: { start: "10:10", end: "11:40" },
  3: { start: "12:00", end: "13:30" },
  4: { start: "13:40", end: "15:10" },
  5: { start: "15:20", end: "16:50" },
  6: { start: "17:00", end: "18:30" },
  7: { start: "18:40", end: "20:10" },
};

/** Номера пар как массив — для рендера строк сетки. */
export const PAIR_INDEXES: number[] = Array.from(
  { length: PAIRS_PER_DAY },
  (_, index) => index + 1,
);

/** Время пары: сначала то, что задал пользователь, иначе дефолт из звонков. */
export function resolvePairTime(
  pairIndex: number,
  startTime: string,
  endTime: string,
): { start: string; end: string } {
  const fallback = DEFAULT_PAIR_TIMES[pairIndex] ?? { start: "", end: "" };
  return {
    start: startTime || fallback.start,
    end: endTime || fallback.end,
  };
}
