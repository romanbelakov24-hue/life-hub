import type { IsoDate } from "@/lib/types";

/**
 * Время в часовом поясе пользователя. Сервер (Cloudflare) живёт в UTC, а
 * «завтра», «в 9 утра» и время утренней сводки — по часам человека.
 */

export const DEFAULT_TIME_ZONE = "Europe/Moscow";

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Текущие дата и время («HH:MM») в указанном поясе. */
export function zonedNow(timeZone: string, now: Date = new Date()): { date: IsoDate; time: string } {
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "00";

  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

/** «9:05» → «09:05»; всё, что не похоже на время суток, — пустая строка. */
export function normalizeTime(value: unknown): string {
  if (typeof value !== "string") return "";
  const match = /^\s*(\d{1,2})[:.](\d{2})\s*$/.exec(value);
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return "";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/** Время плюс минуты, не дальше 23:59 — дело не переезжает на следующий день. */
export function addMinutesCapped(time: string, minutes: number): string {
  const total = Math.min(minutesOfDay(time) + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
