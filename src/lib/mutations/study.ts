import "server-only";

import { db } from "@/lib/db/client";
import type { IsoDate } from "@/lib/types";
import { isValidIso } from "@/lib/utils/date";
import { createId } from "@/lib/utils/id";

/**
 * Запись задач и заметок от имени конкретного пользователя.
 *
 * Зачем отдельный слой, а не прямо в actions/study.ts: писать в эти таблицы
 * теперь умеют двое — серверные действия интерфейса (пользователь из сессии) и
 * API агента (пользователь из токена, см. app/api/agent). Валидация и SQL должны
 * быть одни на обоих, иначе через агента можно было бы записать то, что форма
 * никогда бы не пропустила.
 *
 * Почему не "use server" и не в том же файле, что действия: всё, что
 * экспортирует модуль с "use server", становится вызываемым из браузера. Функция
 * вида insertTask(userId, …) там позволила бы любому посетителю писать задачи
 * в чужой аккаунт, подставив чужой id. Здесь userId приходит только от
 * проверенного вызывающего кода — guard() или проверки токена агента.
 */

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

export function validateTask(input: TaskInput): string | null {
  if (!input.title.trim()) return "Введите название задачи.";
  if (input.title.length > 160) return "Название длиннее 160 символов.";
  if (input.dueDate !== "" && !isValidIso(input.dueDate)) return "Неверная дата дедлайна.";
  if (input.description.length > 2000) return "Описание слишком длинное.";
  if (input.subject.length > 80) return "Название предмета длиннее 80 символов.";
  return null;
}

/** Создаёт задачу и возвращает её id. Вход должен быть уже проверен validateTask. */
export async function insertTask(userId: string, input: TaskInput): Promise<string> {
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

  return id;
}

/** Полная перезапись полей задачи. false — задачи с таким id у пользователя нет. */
export async function updateTaskFields(
  userId: string,
  id: string,
  input: TaskInput,
): Promise<boolean> {
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

  return result.rowsAffected > 0;
}

/** Отметка «выполнено». Время выполнения нужно для счётчика «сделано сегодня». */
export async function setTaskDone(userId: string, id: string, done: boolean): Promise<boolean> {
  const client = await db();
  const result = await client.execute({
    sql: `UPDATE tasks SET done = ?, completed_at = ? WHERE id = ? AND user_id = ?`,
    args: [done ? 1 : 0, done ? new Date().toISOString() : null, id, userId],
  });

  return result.rowsAffected > 0;
}

// ─── Заметки ─────────────────────────────────────────────────────────────────

export interface NoteInput {
  title: string;
  body: string;
  date: IsoDate;
  subject: string;
}

export function validateNote(input: NoteInput): string | null {
  if (!input.title.trim() && !input.body.trim()) return "Заметка пустая.";
  if (input.title.length > 120) return "Заголовок длиннее 120 символов.";
  if (input.body.length > 50_000) return "Заметка слишком длинная.";
  if (input.subject.length > 80) return "Название предмета длиннее 80 символов.";
  if (!isValidIso(input.date)) return "Неверная дата.";
  return null;
}

/** Создаёт заметку и возвращает её id. Вход должен быть уже проверен validateNote. */
export async function insertNote(userId: string, input: NoteInput): Promise<string> {
  const client = await db();
  const id = createId("note");
  const now = new Date().toISOString();

  await client.execute({
    sql: `INSERT INTO notes (id, user_id, title, body, date, subject, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, userId, input.title.trim(), input.body.trim(), input.date, input.subject.trim(), now, now],
  });

  return id;
}
