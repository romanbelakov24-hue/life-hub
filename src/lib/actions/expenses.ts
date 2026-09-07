"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";
import { failure, guard, success, type ActionResult } from "@/lib/actions/types";
import { countExpensesByCategory } from "@/lib/queries/expenses";
import type { IsoDate } from "@/lib/types";
import { isValidIso } from "@/lib/utils/date";
import { roundTo } from "@/lib/utils/format";
import { createId } from "@/lib/utils/id";

/**
 * Серверные действия раздела «Расходы».
 *
 * Каждое действие само валидирует входные данные (клиенту доверять нельзя даже
 * в личном приложении — опечатка в форме не должна класть базу) и после записи
 * дёргает revalidatePath, чтобы серверные страницы перечитали данные.
 */

/** Страницы, которые показывают траты. Обновляем их после любой записи. */
function revalidateExpenseViews(): void {
  revalidatePath("/expenses");
  revalidatePath("/");
}

export interface ExpenseInput {
  date: IsoDate;
  categoryId: string;
  note: string;
  amount: number;
}

/** Общая проверка полей траты. Возвращает текст ошибки или null. */
function validateExpense(input: ExpenseInput): string | null {
  if (!isValidIso(input.date)) return "Неверная дата.";
  if (!input.categoryId) return "Выберите категорию.";
  if (!Number.isFinite(input.amount) || input.amount <= 0) return "Сумма должна быть больше нуля.";
  if (input.amount > 100_000_000) return "Слишком большая сумма.";
  if (input.note.length > 200) return "Заметка длиннее 200 символов.";
  return null;
}

// ─── Траты ───────────────────────────────────────────────────────────────────

export async function createExpense(input: ExpenseInput): Promise<ActionResult<{ id: string }>> {
  return guard(async (userId) => {
    const error = validateExpense(input);
    if (error) return failure(error);

    const client = await db();
    const id = createId("exp");

    await client.execute({
      sql: `INSERT INTO expenses (id, date, category_id, note, amount, created_at, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        input.date,
        input.categoryId,
        input.note.trim(),
        roundTo(input.amount, 2),
        new Date().toISOString(),
        userId,
      ],
    });

    revalidateExpenseViews();
    return success({ id });
  });
}

export async function updateExpense(
  id: string,
  input: ExpenseInput,
): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const error = validateExpense(input);
    if (error) return failure(error);

    const client = await db();
    const result = await client.execute({
      sql: `UPDATE expenses
               SET date = ?, category_id = ?, note = ?, amount = ?
             WHERE id = ? AND user_id = ?`,
      args: [input.date, input.categoryId, input.note.trim(), roundTo(input.amount, 2), id, userId],
    });

    if (result.rowsAffected === 0) return failure("Запись не найдена.");

    revalidateExpenseViews();
    return success(null);
  });
}

export async function deleteExpense(id: string): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const client = await db();
    await client.execute({
      sql: `DELETE FROM expenses WHERE id = ? AND user_id = ?`,
      args: [id, userId],
    });

    revalidateExpenseViews();
    return success(null);
  });
}

// ─── Категории ───────────────────────────────────────────────────────────────

export interface CategoryInput {
  name: string;
  color: string;
  icon: string;
}

function validateCategory(input: CategoryInput): string | null {
  const name = input.name.trim();
  if (!name) return "Введите название категории.";
  if (name.length > 40) return "Название длиннее 40 символов.";
  if (!/^#[0-9a-f]{6}$/i.test(input.color)) return "Неверный формат цвета.";
  return null;
}

export async function createCategory(
  input: CategoryInput,
): Promise<ActionResult<{ id: string }>> {
  return guard(async (userId) => {
    const error = validateCategory(input);
    if (error) return failure(error);

    const client = await db();
    const name = input.name.trim();

    // UNIQUE-индекс по (user_id, name) поймал бы дубль и сам, но так
    // пользователь видит понятное сообщение вместо ошибки базы.
    const duplicate = await client.execute({
      sql: `SELECT id FROM categories WHERE user_id = ? AND lower(name) = lower(?)`,
      args: [userId, name],
    });
    if (duplicate.rows.length > 0) return failure("Категория с таким названием уже есть.");

    const id = createId("cat");
    await client.execute({
      sql: `INSERT INTO categories (id, user_id, name, color, icon, is_default, sort_order)
            VALUES (?, ?, ?, ?, ?, 0, 100)`,
      args: [id, userId, name, input.color, input.icon],
    });

    revalidateExpenseViews();
    return success({ id });
  });
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const error = validateCategory(input);
    if (error) return failure(error);

    const client = await db();
    const result = await client.execute({
      sql: `UPDATE categories SET name = ?, color = ?, icon = ? WHERE id = ? AND user_id = ?`,
      args: [input.name.trim(), input.color, input.icon, id, userId],
    });

    if (result.rowsAffected === 0) return failure("Категория не найдена.");

    revalidateExpenseViews();
    return success(null);
  });
}

/**
 * Удаление категории.
 * Базовые категории и категории с тратами не удаляем — иначе записи потеряют
 * привязку. Пользователю предлагается сначала перенести траты.
 */
export async function deleteCategory(id: string): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const client = await db();

    const existing = await client.execute({
      sql: `SELECT is_default FROM categories WHERE id = ? AND user_id = ?`,
      args: [id, userId],
    });
    const row = existing.rows[0];
    if (!row) return failure("Категория не найдена.");
    if (Number(row.is_default) === 1) return failure("Базовую категорию нельзя удалить.");

    const usage = await countExpensesByCategory(userId, id);
    if (usage > 0) {
      return failure(`В категории ${usage} записей. Сначала перенесите или удалите их.`);
    }

    await client.execute({
      sql: `DELETE FROM categories WHERE id = ? AND user_id = ?`,
      args: [id, userId],
    });

    revalidateExpenseViews();
    return success(null);
  });
}
