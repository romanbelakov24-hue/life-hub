import "server-only";

import type { Row } from "@libsql/client";

import { db } from "@/lib/db/client";
import { bool, num, str, strOrNull } from "@/lib/db/rows";
import type { IsoDate, Note, ScheduleSlot, Task, Weekday } from "@/lib/types";

/**
 * Чтение данных учебного планера: расписание, заметки, задачи.
 * Как и в expenses.ts — только выборки, без бизнес-логики.
 *
 * Каждая функция принимает userId первым параметром и фильтрует им же.
 */

// ─── Расписание ──────────────────────────────────────────────────────────────

function mapSlot(row: Row): ScheduleSlot {
  return {
    id: str(row, "id"),
    weekday: num(row, "weekday", 1) as Weekday,
    pairIndex: num(row, "pair_index", 1),
    subject: str(row, "subject"),
    room: str(row, "room"),
    teacher: str(row, "teacher"),
    startTime: str(row, "start_time"),
    endTime: str(row, "end_time"),
    color: str(row, "color"),
  };
}

/** Вся сетка расписания разом — она маленькая, пагинация не нужна. */
export async function listScheduleSlots(userId: string): Promise<ScheduleSlot[]> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT id, weekday, pair_index, subject, room, teacher, start_time, end_time, color
            FROM schedule_slots
           WHERE user_id = ?
           ORDER BY weekday ASC, pair_index ASC`,
    args: [userId],
  });

  return result.rows.map(mapSlot);
}

/** Пары конкретного дня — для виджета «Сегодня» на обзоре. */
export async function listScheduleForWeekday(
  userId: string,
  weekday: Weekday,
): Promise<ScheduleSlot[]> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT id, weekday, pair_index, subject, room, teacher, start_time, end_time, color
            FROM schedule_slots
           WHERE user_id = ? AND weekday = ?
           ORDER BY pair_index ASC`,
    args: [userId, weekday],
  });

  return result.rows.map(mapSlot);
}

/**
 * Уникальные названия предметов из расписания.
 * Используются как подсказки при привязке заметок и задач к предмету —
 * чтобы не приходилось каждый раз печатать название вручную.
 */
export async function listSubjects(userId: string): Promise<string[]> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT DISTINCT subject
            FROM schedule_slots
           WHERE user_id = ? AND subject <> ''
           ORDER BY subject ASC`,
    args: [userId],
  });

  return result.rows.map((row) => str(row, "subject"));
}

// ─── Заметки ─────────────────────────────────────────────────────────────────

function mapNote(row: Row): Note {
  return {
    id: str(row, "id"),
    title: str(row, "title"),
    body: str(row, "body"),
    date: str(row, "date"),
    subject: str(row, "subject"),
    createdAt: str(row, "created_at"),
    updatedAt: str(row, "updated_at"),
  };
}

/** Заметки, опционально отфильтрованные по предмету. */
export async function listNotes(userId: string, subject?: string): Promise<Note[]> {
  const client = await db();

  const result = subject
    ? await client.execute({
        sql: `SELECT id, title, body, date, subject, created_at, updated_at
                FROM notes
               WHERE user_id = ? AND subject = ?
               ORDER BY date DESC, created_at DESC`,
        args: [userId, subject],
      })
    : await client.execute({
        sql: `SELECT id, title, body, date, subject, created_at, updated_at
                FROM notes
               WHERE user_id = ?
               ORDER BY date DESC, created_at DESC`,
        args: [userId],
      });

  return result.rows.map(mapNote);
}

export async function listRecentNotes(userId: string, limit = 3): Promise<Note[]> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT id, title, body, date, subject, created_at, updated_at
            FROM notes
           WHERE user_id = ?
           ORDER BY updated_at DESC
           LIMIT ?`,
    args: [userId, limit],
  });

  return result.rows.map(mapNote);
}

// ─── Задачи ──────────────────────────────────────────────────────────────────

function mapTask(row: Row): Task {
  return {
    id: str(row, "id"),
    title: str(row, "title"),
    description: str(row, "description"),
    dueDate: str(row, "due_date"),
    done: bool(row, "done"),
    urgent: bool(row, "urgent"),
    important: bool(row, "important"),
    subject: str(row, "subject"),
    createdAt: str(row, "created_at"),
    completedAt: strOrNull(row, "completed_at"),
  };
}

const TASK_SELECT = `
  SELECT id, title, description, due_date, done, urgent, important,
         subject, created_at, completed_at
    FROM tasks
`;

/**
 * Все задачи.
 * Порядок: невыполненные впереди; внутри — сначала с ближайшим дедлайном,
 * задачи без срока уходят в конец (пустая строка сортируется первой,
 * поэтому явно переносим её вниз через CASE).
 */
export async function listTasks(userId: string): Promise<Task[]> {
  const client = await db();
  const result = await client.execute({
    sql: `${TASK_SELECT}
           WHERE user_id = ?
           ORDER BY done ASC,
                    CASE WHEN due_date = '' THEN 1 ELSE 0 END ASC,
                    due_date ASC,
                    created_at DESC`,
    args: [userId],
  });

  return result.rows.map(mapTask);
}

/** Невыполненные задачи с дедлайном не позже указанной даты — виджет обзора. */
export async function listTasksDueBy(
  userId: string,
  date: IsoDate,
  limit = 5,
): Promise<Task[]> {
  const client = await db();
  const result = await client.execute({
    sql: `${TASK_SELECT}
           WHERE user_id = ? AND done = 0 AND due_date <> '' AND due_date <= ?
           ORDER BY due_date ASC
           LIMIT ?`,
    args: [userId, date, limit],
  });

  return result.rows.map(mapTask);
}

/** Счётчики для сводки: сколько всего открыто и сколько просрочено. */
export async function getTaskCounters(
  userId: string,
  today: IsoDate,
): Promise<{ open: number; overdue: number; doneToday: number }> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT
            SUM(CASE WHEN done = 0 THEN 1 ELSE 0 END) AS open_count,
            SUM(CASE WHEN done = 0 AND due_date <> '' AND due_date < ?
                     THEN 1 ELSE 0 END)               AS overdue_count,
            SUM(CASE WHEN done = 1 AND substr(completed_at, 1, 10) = ?
                     THEN 1 ELSE 0 END)               AS done_today_count
          FROM tasks
         WHERE user_id = ?`,
    args: [today, today, userId],
  });

  const row = result.rows[0];
  if (!row) return { open: 0, overdue: 0, doneToday: 0 };

  return {
    open: num(row, "open_count"),
    overdue: num(row, "overdue_count"),
    doneToday: num(row, "done_today_count"),
  };
}
