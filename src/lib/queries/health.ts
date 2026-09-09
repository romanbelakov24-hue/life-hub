import "server-only";

import { db } from "@/lib/db/client";
import { num, str } from "@/lib/db/rows";
import type { HealthDaily, IsoDate } from "@/lib/types";
import type { Row } from "@libsql/client";

/** Чтение данных здоровья. Запись — в api/health/[token]/route.ts (вебхук). */

function mapRow(row: Row): HealthDaily {
  return {
    date: str(row, "date"),
    steps: nullableNum(row, "steps"),
    sleepMinutes: nullableNum(row, "sleep_minutes"),
    restingHeartRate: nullableNum(row, "resting_heart_rate"),
    screenTimeMinutes: nullableNum(row, "screen_time_minutes"),
    updatedAt: str(row, "updated_at"),
  };
}

/** NULL в SQLite отличаем от нуля: 0 шагов — реальное значение, не «нет данных». */
function nullableNum(row: Row, key: string): number | null {
  return row[key] === null || row[key] === undefined ? null : num(row, key);
}

export async function listHealthInRange(
  userId: string,
  from: IsoDate,
  to: IsoDate,
): Promise<HealthDaily[]> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT date, steps, sleep_minutes, resting_heart_rate, screen_time_minutes, updated_at
            FROM health_daily
           WHERE user_id = ? AND date BETWEEN ? AND ?
           ORDER BY date ASC`,
    args: [userId, from, to],
  });

  return result.rows.map(mapRow);
}

/** Последняя строка с хоть каким-то значением — для «свежих показателей» на странице. */
export async function getLatestHealth(userId: string): Promise<HealthDaily | null> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT date, steps, sleep_minutes, resting_heart_rate, screen_time_minutes, updated_at
            FROM health_daily
           WHERE user_id = ?
           ORDER BY date DESC
           LIMIT 1`,
    args: [userId],
  });

  const row = result.rows[0];
  return row ? mapRow(row) : null;
}
