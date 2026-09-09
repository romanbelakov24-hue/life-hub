"use server";

import { revalidatePath } from "next/cache";

import { failure, guard, success, type ActionResult } from "@/lib/actions/types";
import { db } from "@/lib/db/client";
import type { IsoDate } from "@/lib/types";
import { isValidIso } from "@/lib/utils/date";
import { roundTo } from "@/lib/utils/format";
import { createId } from "@/lib/utils/id";

/**
 * Серверные действия раздела «Цели накоплений».
 *
 * Ровно тот же контракт, что и у остальных разделов (см. actions/expenses.ts,
 * actions/income.ts): каждое действие валидирует вход само и не доверяет
 * клиенту, а после записи ревалидирует страницы, которые эти данные рисуют.
 */

function revalidateSavingsViews(): void {
  revalidatePath("/expenses");
  revalidatePath("/expenses/goals");
}

const MAX_AMOUNT = 100_000_000;

export interface GoalInput {
  name: string;
  color: string;
  icon: string;
  targetAmount: number;
  /** Пусто — без срока. */
  targetDate: IsoDate | "";
}

function validateGoal(input: GoalInput): string | null {
  if (!input.name.trim()) return "Укажите название цели.";
  if (input.name.length > 80) return "Название длиннее 80 символов.";
  if (!Number.isFinite(input.targetAmount) || input.targetAmount <= 0) {
    return "Сумма цели должна быть больше нуля.";
  }
  if (input.targetAmount > MAX_AMOUNT) return "Слишком большая сумма.";
  if (input.targetDate && !isValidIso(input.targetDate)) return "Неверная дата срока.";
  return null;
}

// ─── Цели ────────────────────────────────────────────────────────────────────

export async function createGoal(input: GoalInput): Promise<ActionResult<{ id: string }>> {
  return guard(async (userId) => {
    const error = validateGoal(input);
    if (error) return failure(error);

    const client = await db();
    const id = createId("goal");

    await client.execute({
      sql: `INSERT INTO savings_goals
              (id, user_id, name, color, icon, target_amount, target_date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        userId,
        input.name.trim(),
        input.color,
        input.icon,
        roundTo(input.targetAmount, 2),
        input.targetDate || null,
        new Date().toISOString(),
      ],
    });

    revalidateSavingsViews();
    return success({ id });
  });
}

export async function updateGoal(id: string, input: GoalInput): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const error = validateGoal(input);
    if (error) return failure(error);

    const client = await db();
    const result = await client.execute({
      sql: `UPDATE savings_goals
               SET name = ?, color = ?, icon = ?, target_amount = ?, target_date = ?
             WHERE id = ? AND user_id = ?`,
      args: [
        input.name.trim(),
        input.color,
        input.icon,
        roundTo(input.targetAmount, 2),
        input.targetDate || null,
        id,
        userId,
      ],
    });

    if (result.rowsAffected === 0) return failure("Цель не найдена.");

    revalidateSavingsViews();
    return success(null);
  });
}

/** Удаляет цель вместе со всеми её пополнениями (ON DELETE CASCADE в схеме). */
export async function deleteGoal(id: string): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const client = await db();
    await client.execute({
      sql: `DELETE FROM savings_goals WHERE id = ? AND user_id = ?`,
      args: [id, userId],
    });

    revalidateSavingsViews();
    return success(null);
  });
}

// ─── Пополнения ──────────────────────────────────────────────────────────────

export interface ContributionInput {
  goalId: string;
  date: IsoDate;
  amount: number;
  note: string;
}

function validateContribution(input: ContributionInput): string | null {
  if (!isValidIso(input.date)) return "Неверная дата.";
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return "Сумма должна быть больше нуля.";
  }
  if (input.amount > MAX_AMOUNT) return "Слишком большая сумма.";
  if (input.note.length > 120) return "Заметка длиннее 120 символов.";
  return null;
}

export async function addContribution(
  input: ContributionInput,
): Promise<ActionResult<{ id: string }>> {
  return guard(async (userId) => {
    const error = validateContribution(input);
    if (error) return failure(error);

    const client = await db();

    // Цель должна принадлежать тому же пользователю — иначе можно было бы
    // пополнить чужую копилку, просто зная её id.
    const owner = await client.execute({
      sql: `SELECT 1 FROM savings_goals WHERE id = ? AND user_id = ?`,
      args: [input.goalId, userId],
    });
    if (owner.rows.length === 0) return failure("Цель не найдена.");

    const id = createId("contrib");

    await client.execute({
      sql: `INSERT INTO savings_contributions (id, user_id, goal_id, date, amount, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        userId,
        input.goalId,
        input.date,
        roundTo(input.amount, 2),
        input.note.trim(),
        new Date().toISOString(),
      ],
    });

    revalidateSavingsViews();
    return success({ id });
  });
}

export async function deleteContribution(id: string): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const client = await db();
    await client.execute({
      sql: `DELETE FROM savings_contributions WHERE id = ? AND user_id = ?`,
      args: [id, userId],
    });

    revalidateSavingsViews();
    return success(null);
  });
}
