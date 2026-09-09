import "server-only";

import { db } from "@/lib/db/client";
import { num, str, strOrNull } from "@/lib/db/rows";
import type { SavingsContribution, SavingsGoal } from "@/lib/types";

/** Чтение целей накоплений и пополнений. Только выборки, без логики. */

export async function listSavingsGoals(userId: string): Promise<SavingsGoal[]> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT id, name, color, icon, target_amount, target_date, created_at
            FROM savings_goals
           WHERE user_id = ?
           ORDER BY created_at DESC`,
    args: [userId],
  });

  return result.rows.map((row) => ({
    id: str(row, "id"),
    name: str(row, "name"),
    color: str(row, "color"),
    icon: str(row, "icon"),
    targetAmount: num(row, "target_amount"),
    targetDate: strOrNull(row, "target_date"),
    createdAt: str(row, "created_at"),
  }));
}

/**
 * Все пополнения пользователя разом, а не по одной цели за раз: целей у
 * личной копилки немного, а страница целей и так рисует их все на одном
 * экране — считать прогресс каждой в одном проходе по массиву проще и
 * дешевле, чем по отдельному запросу на цель.
 */
export async function listContributions(userId: string): Promise<SavingsContribution[]> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT id, goal_id, date, amount, note, created_at
            FROM savings_contributions
           WHERE user_id = ?
           ORDER BY date DESC, created_at DESC`,
    args: [userId],
  });

  return result.rows.map((row) => ({
    id: str(row, "id"),
    goalId: str(row, "goal_id"),
    date: str(row, "date"),
    amount: num(row, "amount"),
    note: str(row, "note"),
    createdAt: str(row, "created_at"),
  }));
}
