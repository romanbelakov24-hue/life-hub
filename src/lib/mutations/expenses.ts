import "server-only";

import { db } from "@/lib/db/client";
import type { IsoDate, RecordSource } from "@/lib/types";
import { isValidIso } from "@/lib/utils/date";
import { roundTo } from "@/lib/utils/format";
import { createId } from "@/lib/utils/id";

/**
 * Запись трат от имени конкретного пользователя — общая для серверных действий
 * интерфейса и API агента. Почему отдельно от actions/expenses.ts и без
 * "use server" — см. комментарий в lib/mutations/study.ts.
 */

export interface ExpenseInput {
  date: IsoDate;
  categoryId: string;
  note: string;
  amount: number;
}

/** Общая проверка полей траты. Возвращает текст ошибки или null. */
export function validateExpense(input: ExpenseInput): string | null {
  if (!isValidIso(input.date)) return "Неверная дата.";
  if (!input.categoryId) return "Выберите категорию.";
  if (!Number.isFinite(input.amount) || input.amount <= 0) return "Сумма должна быть больше нуля.";
  if (input.amount > 100_000_000) return "Слишком большая сумма.";
  if (input.note.length > 200) return "Заметка длиннее 200 символов.";
  return null;
}

/**
 * Принадлежит ли категория этому пользователю.
 *
 * Внешний ключ expenses.category_id проверяет только, что категория существует,
 * но не чья она. Без этой проверки запрос с подставленным id чужой категории
 * записал бы трату, которая в журнале показывала бы название и цвет категории
 * другого пользователя.
 */
export async function categoryBelongsToUser(userId: string, categoryId: string): Promise<boolean> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT 1 FROM categories WHERE id = ? AND user_id = ?`,
    args: [categoryId, userId],
  });
  return result.rows.length > 0;
}

/**
 * Создаёт трату и возвращает её id; null — категория не принадлежит пользователю.
 * Вход должен быть уже проверен validateExpense.
 */
export async function insertExpense(
  userId: string,
  input: ExpenseInput,
  source: RecordSource = "app",
): Promise<string | null> {
  if (!(await categoryBelongsToUser(userId, input.categoryId))) return null;

  const client = await db();
  const id = createId("exp");

  await client.execute({
    sql: `INSERT INTO expenses (id, date, category_id, note, amount, created_at, user_id, source)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.date,
      input.categoryId,
      input.note.trim(),
      roundTo(input.amount, 2),
      new Date().toISOString(),
      userId,
      source,
    ],
  });

  return id;
}
