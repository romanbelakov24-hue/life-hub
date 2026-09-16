"use server";

import { revalidatePath } from "next/cache";

import { failure, guard, success, type ActionResult } from "@/lib/actions/types";
import { db } from "@/lib/db/client";
import {
  insertNote,
  insertTask,
  setTaskDone,
  updateTaskFields,
  validateNote,
  validateTask,
  type NoteInput,
  type TaskInput,
} from "@/lib/mutations/study";

/**
 * Серверные действия учебного планера: заметки, задачи.
 * Правила те же, что в actions/expenses.ts — валидация на сервере
 * и revalidatePath после каждой записи. Календарь дел — в actions/events.ts.
 *
 * Сама запись и её проверка — в lib/mutations/study.ts: те же функции вызывает
 * API агента, так что правила у интерфейса и у агента не разойдутся.
 */

function revalidateStudyViews(): void {
  revalidatePath("/tasks");
  revalidatePath("/notes");
  revalidatePath("/");
}

// ─── Заметки ─────────────────────────────────────────────────────────────────

export async function createNote(input: NoteInput): Promise<ActionResult<{ id: string }>> {
  return guard(async (userId) => {
    const error = validateNote(input);
    if (error) return failure(error);

    const id = await insertNote(userId, input);

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

export async function createTask(input: TaskInput): Promise<ActionResult<{ id: string }>> {
  return guard(async (userId) => {
    const error = validateTask(input);
    if (error) return failure(error);

    const id = await insertTask(userId, input);

    revalidateStudyViews();
    return success({ id });
  });
}

export async function updateTask(id: string, input: TaskInput): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const error = validateTask(input);
    if (error) return failure(error);

    if (!(await updateTaskFields(userId, id, input))) return failure("Задача не найдена.");

    revalidateStudyViews();
    return success(null);
  });
}

/** Отметка «выполнено». Время выполнения нужно для счётчика «сделано сегодня». */
export async function toggleTaskDone(id: string, done: boolean): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    await setTaskDone(userId, id, done);

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
