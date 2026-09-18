import type { IsoDate } from "@/lib/types";

import { minutesOfDay, zonedNow } from "./dates";

/**
 * Пора ли слать утреннюю сводку. Расписание воркера срабатывает раз в 15 минут;
 * сводка уходит один раз за локальный день, в первые 3 часа после выбранного
 * времени — если воркер пропустил тик, она придёт на следующем, а включённая
 * вечером не свалится внезапно в 20:00.
 */

const SEND_WINDOW_MINUTES = 180;

export interface DigestSchedule {
  digestEnabled: boolean;
  /** «HH:MM» по часам пользователя. */
  digestTime: string;
  /** Локальная дата последней отправленной сводки. */
  lastDigestDate: string;
  timezone: string;
}

export function isDigestDue(schedule: DigestSchedule, now: Date): { due: boolean; localDate: IsoDate } {
  const local = zonedNow(schedule.timezone, now);
  if (!schedule.digestEnabled || schedule.lastDigestDate === local.date) {
    return { due: false, localDate: local.date };
  }
  const late = minutesOfDay(local.time) - minutesOfDay(schedule.digestTime);
  return { due: late >= 0 && late < SEND_WINDOW_MINUTES, localDate: local.date };
}
