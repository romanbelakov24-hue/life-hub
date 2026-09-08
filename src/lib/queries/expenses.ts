import "server-only";

import type { Row } from "@libsql/client";

import { db } from "@/lib/db/client";
import { bool, num, numOrNull, str } from "@/lib/db/rows";
import { DEFAULT_CATEGORIES } from "@/lib/db/schema";
import type { Category, Expense, ExpenseWithCategory, IsoDate } from "@/lib/types";
import { createId } from "@/lib/utils/id";

/**
 * Чтение данных раздела «Расходы».
 *
 * Здесь только выборки из базы — без агрегации и без бизнес-логики.
 * Все подсчёты (итоги, доли, тренды, статистика) живут в
 * src/lib/analytics/expenses.ts как чистые функции: их проще читать,
 * менять и тестировать отдельно от SQL.
 *
 * Каждая функция принимает userId первым параметром и фильтрует им же —
 * без этого один пользователь видел бы траты другого.
 */

// ─── Категории ───────────────────────────────────────────────────────────────

export async function listCategories(userId: string): Promise<Category[]> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT id, name, color, icon, is_default, sort_order, monthly_limit
            FROM categories
           WHERE user_id = ?
           ORDER BY sort_order ASC, name ASC`,
    args: [userId],
  });

  return result.rows.map((row) => ({
    id: str(row, "id"),
    name: str(row, "name"),
    color: str(row, "color"),
    icon: str(row, "icon"),
    isDefault: bool(row, "is_default"),
    sortOrder: num(row, "sort_order"),
    monthlyLimit: numOrNull(row, "monthly_limit"),
  }));
}

/**
 * Заводит стартовый набор категорий новому пользователю.
 *
 * Свои id на каждого — не переиспользуем DEFAULT_CATEGORIES.id (`cat_groceries`
 * и т.д.), они годятся только для легаси-пути SEED_STATEMENTS в db/schema.ts,
 * который создаёт их ровно один раз, глобально, для первого (унаследовавшего
 * старые данные) пользователя. У всех следующих — новые id, иначе второй
 * зарегистрированный столкнулся бы с уже занятым id при вставке.
 */
export async function seedCategoriesForUser(userId: string): Promise<void> {
  const client = await db();
  await client.batch(
    DEFAULT_CATEGORIES.map((category) => ({
      sql: `INSERT INTO categories (id, user_id, name, color, icon, is_default, sort_order)
            VALUES (?, ?, ?, ?, ?, 1, ?)`,
      args: [
        createId("cat"),
        userId,
        category.name,
        category.color,
        category.icon,
        category.sortOrder,
      ],
    })),
    "write",
  );
}

// ─── Траты ───────────────────────────────────────────────────────────────────

const EXPENSE_SELECT = `
  SELECT e.id,
         e.date,
         e.category_id,
         e.note,
         e.amount,
         e.created_at,
         c.name  AS category_name,
         c.color AS category_color,
         c.icon  AS category_icon
    FROM expenses e
    JOIN categories c ON c.id = e.category_id
`;

function mapExpense(row: Row): ExpenseWithCategory {
  return {
    id: str(row, "id"),
    date: str(row, "date"),
    categoryId: str(row, "category_id"),
    note: str(row, "note"),
    amount: num(row, "amount"),
    createdAt: str(row, "created_at"),
    categoryName: str(row, "category_name"),
    categoryColor: str(row, "category_color"),
    categoryIcon: str(row, "category_icon"),
  };
}

/** Траты за диапазон дат включительно. Основной источник данных страницы. */
export async function listExpensesInRange(
  userId: string,
  from: IsoDate,
  to: IsoDate,
): Promise<ExpenseWithCategory[]> {
  const client = await db();
  const result = await client.execute({
    sql: `${EXPENSE_SELECT}
           WHERE e.user_id = ? AND e.date BETWEEN ? AND ?
           ORDER BY e.date DESC, e.created_at DESC`,
    args: [userId, from, to],
  });

  return result.rows.map(mapExpense);
}

/** Последние N трат независимо от периода — для виджета на «Обзоре». */
export async function listRecentExpenses(
  userId: string,
  limit = 5,
): Promise<ExpenseWithCategory[]> {
  const client = await db();
  const result = await client.execute({
    sql: `${EXPENSE_SELECT}
           WHERE e.user_id = ?
           ORDER BY e.date DESC, e.created_at DESC
           LIMIT ?`,
    args: [userId, limit],
  });

  return result.rows.map(mapExpense);
}

/** Сумма трат за диапазон. Считается в SQL — данные за пределами месяца не грузим. */
export async function sumExpensesInRange(
  userId: string,
  from: IsoDate,
  to: IsoDate,
): Promise<number> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT COALESCE(SUM(amount), 0) AS total
            FROM expenses
           WHERE user_id = ? AND date BETWEEN ? AND ?`,
    args: [userId, from, to],
  });

  const row = result.rows[0];
  return row ? num(row, "total") : 0;
}

/**
 * Итоги по месяцам за последние `monthsBack` месяцев (включая текущий).
 * Используется графиком сравнения месяцев.
 */
export async function listMonthlyTotals(
  userId: string,
  monthsBack = 6,
): Promise<Array<{ monthKey: string; total: number }>> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT substr(date, 1, 7) AS month_key,
                 SUM(amount)        AS total
            FROM expenses
           WHERE user_id = ?
           GROUP BY month_key
           ORDER BY month_key DESC
           LIMIT ?`,
    args: [userId, monthsBack],
  });

  // SQL отдаёт от новых к старым — на графике нужен хронологический порядок.
  return result.rows
    .map((row) => ({
      monthKey: str(row, "month_key"),
      total: num(row, "total"),
    }))
    .reverse();
}

/** Одна трата по id — нужна серверным действиям для проверок перед записью. */
export async function findExpense(userId: string, id: string): Promise<Expense | null> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT id, date, category_id, note, amount, created_at
            FROM expenses
           WHERE id = ? AND user_id = ?`,
    args: [id, userId],
  });

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: str(row, "id"),
    date: str(row, "date"),
    categoryId: str(row, "category_id"),
    note: str(row, "note"),
    amount: num(row, "amount"),
    createdAt: str(row, "created_at"),
  };
}

/** Сколько трат ссылается на категорию — блокирует удаление непустой категории. */
export async function countExpensesByCategory(userId: string, categoryId: string): Promise<number> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT COUNT(*) AS total FROM expenses WHERE user_id = ? AND category_id = ?`,
    args: [userId, categoryId],
  });

  const row = result.rows[0];
  return row ? num(row, "total") : 0;
}

/** Самая ранняя трата — определяет, с какого месяца есть данные. */
export async function findEarliestExpenseDate(userId: string): Promise<IsoDate | null> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT MIN(date) AS first_date FROM expenses WHERE user_id = ?`,
    args: [userId],
  });

  const row = result.rows[0];
  const value = row ? str(row, "first_date") : "";
  return value || null;
}
