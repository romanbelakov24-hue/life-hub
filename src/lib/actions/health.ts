"use server";

import { revalidatePath } from "next/cache";

import { failure, guard, success, type ActionResult } from "@/lib/actions/types";
import { db } from "@/lib/db/client";
import type { IsoDate } from "@/lib/types";
import { isValidIso } from "@/lib/utils/date";

/**
 * Серверные действия раздела «Здоровье».
 *
 * Единственное поле, которое заносится руками, а не приходит из вебхука
 * автоматизации (см. api/health/[token]/route.ts) — экранное время: у Apple
 * нет действия Shortcuts, которое читало бы его так же, как шаги или сон.
 */

const MAX_MINUTES = 24 * 60;

export interface ScreenTimeInput {
  date: IsoDate;
  /** Минуты, 0…1440. */
  minutes: number;
}

function validateScreenTime(input: ScreenTimeInput): string | null {
  if (!isValidIso(input.date)) return "Неверная дата.";
  if (!Number.isFinite(input.minutes) || input.minutes < 0) return "Неверное время.";
  if (input.minutes > MAX_MINUTES) return "Не может быть больше суток.";
  return null;
}

/**
 * Записывает экранное время за день, не трогая остальные поля этой строки
 * (шаги/сон/пульс могли уже прийти из автоматизации) — тот же принцип
 * независимых полей, что и в вебхуке.
 */
export async function logScreenTime(input: ScreenTimeInput): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const error = validateScreenTime(input);
    if (error) return failure(error);

    const client = await db();
    await client.execute({
      sql: `INSERT INTO health_daily (user_id, date, screen_time_minutes, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, date) DO UPDATE SET
              screen_time_minutes = excluded.screen_time_minutes,
              updated_at           = excluded.updated_at`,
      args: [userId, input.date, Math.round(input.minutes), new Date().toISOString()],
    });

    revalidatePath("/health");
    revalidatePath("/");
    return success(null);
  });
}
