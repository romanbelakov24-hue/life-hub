import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { db } from "@/lib/db/client";

/**
 * Сессии — строка в базе, а не подписанный токен (JWT).
 *
 * Проще для приложения такого размера: не нужен секрет для подписи и его
 * ротация, а выход из аккаунта или отзыв сессии — это просто DELETE одной
 * строки, без списков отозванных токенов. Токен в cookie — непредсказуемый
 * (32 случайных байта), сам по себе не несёт данных, только служит ключом.
 */

const SESSION_COOKIE = "session";
const SESSION_DAYS = 30;

function sessionMaxAgeSeconds(): number {
  return SESSION_DAYS * 24 * 60 * 60;
}

function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Создаёт сессию и кладёт её токен в cookie.
 * Вызывать только из Server Action или Route Handler — в серверном
 * компоненте страницы next/headers не даёт менять cookies.
 */
export async function createSession(userId: string): Promise<void> {
  const token = createSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionMaxAgeSeconds() * 1000);

  const client = await db();
  await client.execute({
    sql: `INSERT INTO sessions (token, user_id, created_at, expires_at)
          VALUES (?, ?, ?, ?)`,
    args: [token, userId, now.toISOString(), expiresAt.toISOString()],
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAgeSeconds(),
  });
}

/** Токен из cookie текущего запроса, если он есть. */
export async function readSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * user_id по токену сессии, с проверкой срока действия.
 * Просроченную сессию заодно удаляет — не копится мусор от старых визитов.
 */
export async function resolveSessionUserId(token: string): Promise<string | null> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT user_id, expires_at FROM sessions WHERE token = ?`,
    args: [token],
  });

  const row = result.rows[0];
  if (!row) return null;

  const expiresAt = String(row.expires_at ?? "");
  if (!expiresAt || new Date(expiresAt).getTime() < Date.now()) {
    await client.execute({ sql: `DELETE FROM sessions WHERE token = ?`, args: [token] });
    return null;
  }

  return String(row.user_id ?? "") || null;
}

/** Завершает сессию: удаляет её из базы и стирает cookie. Только из Server Action. */
export async function destroySession(): Promise<void> {
  const token = await readSessionToken();

  if (token) {
    const client = await db();
    await client.execute({ sql: `DELETE FROM sessions WHERE token = ?`, args: [token] });
  }

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
