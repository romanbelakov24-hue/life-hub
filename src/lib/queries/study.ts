import "server-only";

import type { Row } from "@libsql/client";

import { db } from "@/lib/db/client";
import { bool, num, str, strOrNull } from "@/lib/db/rows";
import type { IsoDate, Note, Task } from "@/lib/types";

/**
 * Чтение данных учебного планера: заметки, задачи.
 * Как и в expenses.ts — только выборки, без бизнес-логики.
 *
 * Каждая функция принимает userId первым параметром и фильтрует им же.
 */

/**
 * Уникальные названия предметов, уже встречавшиеся в заметках и задачах —
 * подсказки при заполнении поля «предмет», чтобы не печатать одно и то же
 * название каждый раз заново. Раньше источником было расписание пар; после
 * перехода на календарь дел источник — сами заметки и задачи.
 */
export async function listSubjects(userId: string): Promise<string[]> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT subject FROM notes WHERE user_id = ? AND subject <> ''
          UNION
          SELECT subject FROM tasks WHERE user_id = ? AND subject <> ''
          ORDER BY subject ASC`,
    args: [userId, userId],
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
