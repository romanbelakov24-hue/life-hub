import "server-only";

import { db } from "@/lib/db/client";
import { str } from "@/lib/db/rows";

/** Пользователь приложения — то немногое, что о нём известно. */
export interface AppUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

function mapUser(row: Record<string, unknown>): AppUser {
  return {
    id: String(row.id ?? ""),
    email: String(row.email ?? ""),
    name: String(row.name ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

export async function findUserByEmail(
  email: string,
): Promise<(AppUser & { passwordHash: string }) | null> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT id, email, password_hash, name, created_at
            FROM users WHERE lower(email) = lower(?)`,
    args: [email],
  });

  const row = result.rows[0];
  if (!row) return null;

  return { ...mapUser(row), passwordHash: str(row, "password_hash") };
}

export async function findUserById(id: string): Promise<AppUser | null> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT id, email, name, created_at FROM users WHERE id = ?`,
    args: [id],
  });

  const row = result.rows[0];
  return row ? mapUser(row) : null;
}

/** Есть ли в базе хоть один пользователь — определяет, кто «первый». */
export async function hasAnyUser(): Promise<boolean> {
  const client = await db();
  const result = await client.execute(`SELECT 1 FROM users LIMIT 1`);
  return result.rows.length > 0;
}

export async function createUser(input: {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: string;
}): Promise<void> {
  const client = await db();
  await client.execute({
    sql: `INSERT INTO users (id, email, password_hash, name, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [input.id, input.email.toLowerCase(), input.passwordHash, input.name, input.createdAt],
  });
}

/**
 * Таблицы, где до многопользовательского режима не было владельца.
 * Порядок не важен — каждая строка обновляется независимо.
 */
const LEGACY_TABLES = [
  "expenses",
  "categories",
  "events",
  "notes",
  "tasks",
  "incomes",
  "health_daily",
  "settings",
  "savings_goals",
  "savings_contributions",
] as const;

/**
 * Отдаёт первому зарегистрированному пользователю все записи без владельца.
 *
 * До регистрации у каждой строки во всех таблицах user_id = NULL — это данные
 * с тех времён, когда в life hub был ровно один пользователь без аккаунта.
 * Вызывается один раз, сразу после того, как hasAnyUser() перед регистрацией
 * ответил «нет» — то есть только для самого первого аккаунта в базе.
 */
export async function claimLegacyData(userId: string): Promise<void> {
  const client = await db();
  await client.batch(
    LEGACY_TABLES.map((table) => ({
      sql: `UPDATE ${table} SET user_id = ? WHERE user_id IS NULL`,
      args: [userId],
    })),
    "write",
  );
}
