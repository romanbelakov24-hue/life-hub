"use server";

import { revalidatePath } from "next/cache";

import { failure, guard, success, type ActionResult } from "@/lib/actions/types";
import { db } from "@/lib/db/client";
import type { IsoDate, Weekday } from "@/lib/types";
import { isValidIso } from "@/lib/utils/date";
import { createId } from "@/lib/utils/id";

/**
 * Серверные действия учебного планера: расписание, заметки, задачи.
 * Правила те же, что в actions/expenses.ts — валидация на сервере
 * и revalidatePath после каждой записи.
 */

function revalidateStudyViews(): void {
  revalidatePath("/schedule");
  revalidatePath("/tasks");
  revalidatePath("/notes");
  revalidatePath("/");
}

/** Время в формате HH:MM или пустая строка (значит «взять из расписания звонков»). */
function isValidTime(value: string): boolean {
  return value === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

// ─── Расписание ──────────────────────────────────────────────────────────────

export interface ScheduleSlotInput {
  weekday: Weekday;
  pairIndex: number;
  subject: string;
  room: string;
  teacher: string;
  startTime: string;
  endTime: string;
  color: string;
}

function validateSlot(input: ScheduleSlotInput): string | null {
  if (!input.subject.trim()) return "Введите название предмета.";
  if (input.subject.length > 80) return "Название предмета слишком длинное.";
  if (input.weekday < 1 || input.weekday > 7) return "Неверный день недели.";
  if (input.pairIndex < 1 || input.pairIndex > 12) return "Неверный номер пары.";
  if (!isValidTime(input.startTime) || !isValidTime(input.endTime)) {
    return "Время указывается в формате ЧЧ:ММ.";
  }
  return null;
}

/**
 * Создаёт или перезаписывает пару в ячейке (день × номер пары).
 * Ячейка уникальна в пределах пользователя, поэтому используем UPSERT:
 * повторное сохранение той же ячейки не плодит дубли, а обновляет содержимое.
 */
export async function saveScheduleSlot(
  input: ScheduleSlotInput,
): Promise<ActionResult<{ id: string }>> {
  return guard(async (userId) => {
    const error = validateSlot(input);
    if (error) return failure(error);

    const client = await db();
    const id = createId("slot");

    await client.execute({
      sql: `INSERT INTO schedule_slots
              (id, user_id, weekday, pair_index, subject, room, teacher, start_time, end_time, color)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, weekday, pair_index) DO UPDATE SET
              subject    = excluded.subject,
              room       = excluded.room,
              teacher    = excluded.teacher,
              start_time = excluded.start_time,
              end_time   = excluded.end_time,
              color      = excluded.color`,
      args: [
        id,
        userId,
        input.weekday,
        input.pairIndex,
        input.subject.trim(),
        input.room.trim(),
        input.teacher.trim(),
        input.startTime,
        input.endTime,
        input.color,
      ],
    });

    revalidateStudyViews();
    return success({ id });
  });
}

export async function deleteScheduleSlot(id: string): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const client = await db();
    await client.execute({
      sql: `DELETE FROM schedule_slots WHERE id = ? AND user_id = ?`,
      args: [id, userId],
    });

    revalidateStudyViews();
    return success(null);
  });
}

/** Очистка всего дня целиком — быстрее, чем удалять пары по одной. */
export async function clearScheduleDay(weekday: Weekday): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const client = await db();
    await client.execute({
      sql: `DELETE FROM schedule_slots WHERE weekday = ? AND user_id = ?`,
      args: [weekday, userId],
    });

    revalidateStudyViews();
    return success(null);
  });
}

// ─── Заметки ─────────────────────────────────────────────────────────────────

export interface NoteInput {
  title: string;
  body: string;
  date: IsoDate;
  subject: string;
}

function validateNote(input: NoteInput): string | null {
  if (!input.title.trim() && !input.body.trim()) return "Заметка пустая.";
  if (input.title.length > 120) return "Заголовок длиннее 120 символов.";
  if (!isValidIso(input.date)) return "Неверная дата.";
  return null;
}

export async function createNote(input: NoteInput): Promise<ActionResult<{ id: string }>> {
  return guard(async (userId) => {
    const error = validateNote(input);
    if (error) return failure(error);

    const client = await db();
    const id = createId("note");
    const now = new Date().toISOString();

    await client.execute({
      sql: `INSERT INTO notes (id, user_id, title, body, date, subject, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        userId,
        input.title.trim(),
        input.body.trim(),
        input.date,
        input.subject.trim(),
        now,
        now,
      ],
    });

    revalidateStudyViews();
    return success({ id });
  });
}

export async function updateNote(id: string, input: NoteInput): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const error = validateNote(input);
    if (error) return failure(error);

    const client = await db();
    const result = await client.execute({
      sql: `UPDATE notes
               SET title = ?, body = ?, date = ?, subject = ?, updated_at = ?
             WHERE id = ? AND user_id = ?`,
      args: [
        input.title.trim(),
        input.body.trim(),
        input.date,
        input.subject.trim(),
        new Date().toISOString(),
        id,
        userId,
      ],
    });

    if (result.rowsAffected === 0) return failure("Заметка не найдена.");

    revalidateStudyViews();
    return success(null);
  });
}

export async function deleteNote(id: string): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const client = await db();
    await client.execute({
      sql: `DELETE FROM notes WHERE id = ? AND user_id = ?`,
      args: [id, userId],
    });

    revalidateStudyViews();
    return success(null);
  });
}

// ─── Задачи ──────────────────────────────────────────────────────────────────

export interface TaskInput {
  title: string;
  description: string;
  /** Пустая строка — задача без дедлайна. */
  dueDate: string;
  urgent: boolean;
  important: boolean;
  subject: string;
}

function validateTask(input: TaskInput): string | null {
  if (!input.title.trim()) return "Введите название задачи.";
  if (input.title.length > 160) return "Название длиннее 160 символов.";
  if (input.dueDate !== "" && !isValidIso(input.dueDate)) return "Неверная дата дедлайна.";
  return null;
}

export async function createTask(input: TaskInput): Promise<ActionResult<{ id: string }>> {
  return guard(async (userId) => {
    const error = validateTask(input);
    if (error) return failure(error);

    const client = await db();
    const id = createId("task");

    await client.execute({
      sql: `INSERT INTO tasks
              (id, user_id, title, description, due_date, done, urgent, important, subject, created_at, completed_at)
            VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, NULL)`,
      args: [
        id,
        userId,
        input.title.trim(),
        input.description.trim(),
        input.dueDate,
        input.urgent ? 1 : 0,
        input.important ? 1 : 0,
        input.subject.trim(),
        new Date().toISOString(),
      ],
    });

    revalidateStudyViews();
    return success({ id });
  });
}

export async function updateTask(id: string, input: TaskInput): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const error = validateTask(input);
    if (error) return failure(error);

    const client = await db();
    const result = await client.execute({
      sql: `UPDATE tasks
               SET title = ?, description = ?, due_date = ?, urgent = ?, important = ?, subject = ?
             WHERE id = ? AND user_id = ?`,
      args: [
        input.title.trim(),
        input.description.trim(),
        input.dueDate,
        input.urgent ? 1 : 0,
        input.important ? 1 : 0,
        input.subject.trim(),
        id,
        userId,
      ],
    });

    if (result.rowsAffected === 0) return failure("Задача не найдена.");

    revalidateStudyViews();
    return success(null);
  });
}

/** Отметка «выполнено». Время выполнения нужно для счётчика «сделано сегодня». */
export async function toggleTaskDone(id: string, done: boolean): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const client = await db();
    await client.execute({
      sql: `UPDATE tasks SET done = ?, completed_at = ? WHERE id = ? AND user_id = ?`,
      args: [done ? 1 : 0, done ? new Date().toISOString() : null, id, userId],
    });

    revalidateStudyViews();
    return success(null);
  });
}

/** Перенос задачи в другой квадрант матрицы Эйзенхауэра. */
export async function setTaskQuadrant(
  id: string,
  urgent: boolean,
  important: boolean,
): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const client = await db();
    await client.execute({
      sql: `UPDATE tasks SET urgent = ?, important = ? WHERE id = ? AND user_id = ?`,
      args: [urgent ? 1 : 0, important ? 1 : 0, id, userId],
    });

    revalidateStudyViews();
    return success(null);
  });
}

export async function deleteTask(id: string): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const client = await db();
    await client.execute({
      sql: `DELETE FROM tasks WHERE id = ? AND user_id = ?`,
      args: [id, userId],
    });

    revalidateStudyViews();
    return success(null);
  });
}

/** Убрать все выполненные задачи разом. */
export async function clearCompletedTasks(): Promise<ActionResult<{ removed: number }>> {
  return guard(async (userId) => {
    const client = await db();
    const result = await client.execute({
      sql: `DELETE FROM tasks WHERE done = 1 AND user_id = ?`,
      args: [userId],
    });

    revalidateStudyViews();
    return success({ removed: result.rowsAffected });
  });
}
