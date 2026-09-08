"use server";

import { revalidatePath } from "next/cache";

import { failure, guard, success, type ActionResult } from "@/lib/actions/types";
import { db } from "@/lib/db/client";
import type { IsoDate } from "@/lib/types";
import { addDays, isValidIso } from "@/lib/utils/date";
import { createId } from "@/lib/utils/id";

/**
 * Серверные действия календаря. Правила те же, что в actions/expenses.ts —
 * валидация на сервере и revalidatePath после каждой записи.
 */

function revalidateEventViews(): void {
  revalidatePath("/schedule");
  revalidatePath("/");
}

/** Время в формате HH:MM или пустая строка (без времени — дело на весь день). */
function isValidTime(value: string): boolean {
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

function validateEvent(input: EventInput): string | null {
  if (!input.title.trim()) return "Введите название.";
  if (input.title.length > 120) return "Название длиннее 120 символов.";
  if (!isValidIso(input.date)) return "Неверная дата.";
  if (!isValidTime(input.startTime) || !isValidTime(input.endTime)) {
    return "Время указывается в формате ЧЧ:ММ.";
  }
  if (input.location.length > 120) return "Место длиннее 120 символов.";
  if (input.description.length > 2000) return "Описание слишком длинное.";
  if (input.repeatWeeklyUntil !== undefined) {
    if (!isValidIso(input.repeatWeeklyUntil)) return "Неверная дата окончания повтора.";
    if (input.repeatWeeklyUntil < input.date) {
      return "Дата окончания повтора раньше даты начала.";
    }
  }
  return null;
}

export async function createEvent(input: EventInput): Promise<ActionResult<{ id: string }>> {
  return guard(async (userId) => {
    const error = validateEvent(input);
    if (error) return failure(error);

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

    revalidateEventViews();
    return success({ id: firstId });
  });
}

/** Правка одного дела — серии, созданные повтором, при этом не затрагиваются. */
export async function updateEvent(id: string, input: EventInput): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const error = validateEvent({ ...input, repeatWeeklyUntil: undefined });
    if (error) return failure(error);

    const client = await db();
    const result = await client.execute({
      sql: `UPDATE events
               SET date = ?, start_time = ?, end_time = ?, title = ?,
                   location = ?, description = ?, color = ?
             WHERE id = ? AND user_id = ?`,
      args: [
        input.date,
        input.startTime,
        input.endTime,
        input.title.trim(),
        input.location.trim(),
        input.description.trim(),
        input.color,
        id,
        userId,
      ],
    });

    if (result.rowsAffected === 0) return failure("Дело не найдено.");

    revalidateEventViews();
    return success(null);
  });
}

export async function deleteEvent(id: string): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const client = await db();
    await client.execute({
      sql: `DELETE FROM events WHERE id = ? AND user_id = ?`,
      args: [id, userId],
    });

    revalidateEventViews();
    return success(null);
  });
}
