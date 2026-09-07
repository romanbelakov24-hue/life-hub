"use server";

import { revalidatePath } from "next/cache";

import { failure, guard, success, type ActionResult } from "@/lib/actions/types";
import { db } from "@/lib/db/client";
import type { IsoDate } from "@/lib/types";
import { isValidIso } from "@/lib/utils/date";
import { roundTo } from "@/lib/utils/format";
import { createId } from "@/lib/utils/id";

/** Серверные действия раздела доходов. */

export interface IncomeInput {
  date: IsoDate;
  amount: number;
  source: string;
}

function revalidateBudgetViews(): void {
  revalidatePath("/expenses");
  revalidatePath("/expenses/income");
  revalidatePath("/");
}

function validateIncome(input: IncomeInput): string | null {
  if (!isValidIso(input.date)) return "Неверная дата.";
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return "Сумма должна быть больше нуля.";
  }
  if (input.amount > 1_000_000_000) return "Слишком большая сумма.";
  if (input.source.length > 80) return "Источник длиннее 80 символов.";
  return null;
}

export async function createIncome(input: IncomeInput): Promise<ActionResult<{ id: string }>> {
  return guard(async (userId) => {
    const error = validateIncome(input);
    if (error) return failure(error);

    const client = await db();
    const id = createId("inc");

    await client.execute({
      sql: `INSERT INTO incomes (id, user_id, date, amount, source, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        userId,
        input.date,
        roundTo(input.amount, 2),
        input.source.trim(),
        new Date().toISOString(),
      ],
    });

    revalidateBudgetViews();
    return success({ id });
  });
}

export async function updateIncome(
  id: string,
  input: IncomeInput,
): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const error = validateIncome(input);
    if (error) return failure(error);

    const client = await db();
    const result = await client.execute({
      sql: `UPDATE incomes SET date = ?, amount = ?, source = ? WHERE id = ? AND user_id = ?`,
      args: [input.date, roundTo(input.amount, 2), input.source.trim(), id, userId],
    });

    if (result.rowsAffected === 0) return failure("Запись не найдена.");

    revalidateBudgetViews();
    return success(null);
  });
}

export async function deleteIncome(id: string): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const client = await db();
    await client.execute({
      sql: `DELETE FROM incomes WHERE id = ? AND user_id = ?`,
      args: [id, userId],
    });

    revalidateBudgetViews();
    return success(null);
  });
}
