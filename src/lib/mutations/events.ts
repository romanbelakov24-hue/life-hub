import "server-only";

import { db } from "@/lib/db/client";
import type { IsoDate } from "@/lib/types";
import { addDays, isValidIso } from "@/lib/utils/date";
import { createId } from "@/lib/utils/id";

/**
 * Запись дел календаря от имени конкретного пользователя — общая для серверных
 * действий интерфейса и API агента. Почему отдельно от actions/events.ts и без
 * "use server" — см. комментарий в lib/mutations/study.ts.
 */

/** Время в формате HH:MM или пустая строка (без времени — дело на весь день). */
export function isValidTime(value: string): boolean {
  return value === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export interface EventInput {
  date: IsoDate;
  startTime: string;
  endTime: string;
  title: string;
  location: string;
  description: string;
  color: string;
  /**
   * Если задано — вместо одного дела создаётся серия: та же дата каждую
   * неделю до этой даты включительно. Каждая строка получает свой id и дальше
   * живёт независимо: отменить или подвинуть одно занятие не трогает
   * остальные — хранимого правила повторения нет, только исходные копии.
   */
  repeatWeeklyUntil?: string;
}

/** Не даём случайно наштамповать дела на десятилетия вперёд одной опечаткой в дате. */
const MAX_REPEAT_OCCURRENCES = 104; // два года еженедельно

export function validateEvent(input: EventInput): string | null {
  if (!input.title.trim()) return "Введите название.";
  if (input.title.length > 120) return "Название длиннее 120 символов.";
  if (!isValidIso(input.date)) return "Неверная дата.";
  if (!isValidTime(input.startTime) || !isValidTime(input.endTime)) {
    return "Время указывается в формате ЧЧ:ММ.";
  }
  if (input.location.length > 120) return "Место длиннее 120 символов.";
  if (input.description.length > 2000) return "Описание слишком длинное.";
  if (!/^#[0-9a-f]{6}$/i.test(input.color)) return "Неверный формат цвета.";
  if (input.repeatWeeklyUntil !== undefined) {
    if (!isValidIso(input.repeatWeeklyUntil)) return "Неверная дата окончания повтора.";
    if (input.repeatWeeklyUntil < input.date) {
      return "Дата окончания повтора раньше даты начала.";
    }
  }
  return null;
}

/**
 * Создаёт дело (или серию, если задан repeatWeeklyUntil) и возвращает id первого.
 * Вход должен быть уже проверен validateEvent.
 */
export async function insertEvents(userId: string, input: EventInput): Promise<string> {
  const client = await db();
  const now = new Date().toISOString();

  // Без повтора — просто список из одной даты; с повтором — та же дата
  // каждые 7 дней до repeatWeeklyUntil включительно.
  const dates: IsoDate[] = [input.date];
  if (input.repeatWeeklyUntil) {
    let cursor = addDays(input.date, 7);
    while (cursor <= input.repeatWeeklyUntil && dates.length < MAX_REPEAT_OCCURRENCES) {
      dates.push(cursor);
      cursor = addDays(cursor, 7);
    }
  }

  const firstId = createId("evt");
  const rows = dates.map((date, index) => ({
    id: index === 0 ? firstId : createId("evt"),
    date,
  }));

  await client.batch(
    rows.map(({ id, date }) => ({
      sql: `INSERT INTO events
              (id, user_id, date, start_time, end_time, title, location, description, color, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        userId,
        date,
        input.startTime,
        input.endTime,
        input.title.trim(),
        input.location.trim(),
        input.description.trim(),
        input.color,
        now,
      ],
    })),
    "write",
  );

  return firstId;
}
