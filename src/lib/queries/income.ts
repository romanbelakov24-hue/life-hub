import "server-only";

import { db } from "@/lib/db/client";
import { num, str } from "@/lib/db/rows";
import type { Income, IsoDate } from "@/lib/types";

/** Чтение доходов. Как и в остальных queries — только выборки, без логики. */

export async function listIncomesInRange(
  userId: string,
  from: IsoDate,
  to: IsoDate,
): Promise<Income[]> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT id, date, amount, source, created_at
            FROM incomes
           WHERE user_id = ? AND date BETWEEN ? AND ?
           ORDER BY date DESC, created_at DESC`,
    args: [userId, from, to],
  });

  return result.rows.map((row) => ({
    id: str(row, "id"),
    date: str(row, "date"),
    amount: num(row, "amount"),
    source: str(row, "source"),
    createdAt: str(row, "created_at"),
  }));
}

export async function sumIncomesInRange(
  userId: string,
  from: IsoDate,
  to: IsoDate,
): Promise<number> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT COALESCE(SUM(amount), 0) AS total
            FROM incomes
           WHERE user_id = ? AND date BETWEEN ? AND ?`,
    args: [userId, from, to],
  });

  const row = result.rows[0];
  return row ? num(row, "total") : 0;
}

/**
 * Средний расход в день за завершённые месяцы до указанного.
 *
 * Текущий месяц исключается намеренно: он неполный, и в начале месяца пара
 * крупных покупок дала бы среднее, по которому прогноз улетал бы в космос.
 * Берём последние `monthsBack` месяцев, где траты вообще были.
 */
export async function getHistoricalDailyRate(
  userId: string,
  beforeMonthKey: string,
  monthsBack = 3,
): Promise<number | null> {
  const client = await db();

  const result = await client.execute({
    sql: `SELECT substr(date, 1, 7) AS month_key,
                 SUM(amount)        AS total,
                 COUNT(DISTINCT date) AS days
            FROM expenses
           WHERE user_id = ? AND substr(date, 1, 7) < ?
           GROUP BY month_key
           ORDER BY month_key DESC
           LIMIT ?`,
    args: [userId, beforeMonthKey, monthsBack],
  });

  if (result.rows.length === 0) return null;

  // Делим на календарные дни месяца, а не на дни с тратами: пропущенные дни —
  // это тоже часть бюджета, в них просто ничего не купили.
  let total = 0;
  let days = 0;

  for (const row of result.rows) {
    const monthKey = str(row, "month_key");
    const [year, month] = monthKey.split("-").map(Number);
    if (!year || !month) continue;

    total += num(row, "total");
    days += new Date(year, month, 0).getDate();
  }

  return days > 0 ? total / days : null;
}
