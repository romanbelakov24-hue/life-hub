import "server-only";

import type { Row } from "@libsql/client";

import { db } from "@/lib/db/client";
import { bool, num, str } from "@/lib/db/rows";

import { DEFAULT_TIME_ZONE } from "./dates";

/**
 * Данные бота в базе: привязки чатов, одноразовые коды привязки и журнал.
 *
 * Все функции с userId пишут и читают только строки этого пользователя.
 * userId сюда приходит либо из сессии (guard в actions/telegram.ts), либо из
 * привязки чата — то есть от кода, которому Telegram подтвердил, чей это чат.
 */

export interface TelegramLink {
  userId: string;
  chatId: string;
  username: string;
  firstName: string;
  timezone: string;
  digestEnabled: boolean;
  /** «HH:MM» по часовому поясу пользователя. */
  digestTime: string;
  /** Локальная дата последней отправленной сводки. */
  lastDigestDate: string;
  linkedAt: string;
}

function mapLink(r: Row): TelegramLink {
  return {
    userId: str(r, "user_id"),
    chatId: str(r, "chat_id"),
    username: str(r, "username"),
    firstName: str(r, "first_name"),
    timezone: str(r, "timezone") || DEFAULT_TIME_ZONE,
    digestEnabled: bool(r, "digest_enabled"),
    digestTime: str(r, "digest_time") || "08:00",
    lastDigestDate: str(r, "last_digest_date"),
    linkedAt: str(r, "linked_at"),
  };
}

const LINK_SELECT = `SELECT user_id, chat_id, username, first_name, timezone, digest_enabled,
                            digest_time, last_digest_date, linked_at
                       FROM telegram_links`;

export async function findLinkByChat(chatId: string): Promise<TelegramLink | null> {
  const client = await db();
  const result = await client.execute({ sql: `${LINK_SELECT} WHERE chat_id = ?`, args: [chatId] });
  const row = result.rows[0];
  return row ? mapLink(row) : null;
}

export async function findLinkByUser(userId: string): Promise<TelegramLink | null> {
  const client = await db();
  const result = await client.execute({ sql: `${LINK_SELECT} WHERE user_id = ?`, args: [userId] });
  const row = result.rows[0];
  return row ? mapLink(row) : null;
}

/** Все включённые сводки вместе с именем пользователя — для рассылки по расписанию. */
export async function listDigestSubscribers(): Promise<Array<TelegramLink & { name: string }>> {
  const client = await db();
  const result = await client.execute(
    `SELECT l.user_id, l.chat_id, l.username, l.first_name, l.timezone, l.digest_enabled,
            l.digest_time, l.last_digest_date, l.linked_at, u.name
       FROM telegram_links l JOIN users u ON u.id = l.user_id
      WHERE l.digest_enabled = 1`,
  );
  return result.rows.map((row) => ({ ...mapLink(row), name: str(row, "name") }));
}

// ─── Привязка ────────────────────────────────────────────────────────────────

const LINK_CODE_TTL_MINUTES = 15;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Новый одноразовый код для ссылки t.me/<бот>?start=<код>. Прежние коды
 * пользователя сгорают — действует только последняя выданная ссылка.
 */
export async function createLinkCode(userId: string, timezone: string): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const code = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MINUTES * 60_000).toISOString();

  const client = await db();
  await client.batch(
    [
      { sql: `DELETE FROM telegram_link_codes WHERE user_id = ? OR expires_at < ?`, args: [userId, new Date().toISOString()] },
      {
        sql: `INSERT INTO telegram_link_codes (code_hash, user_id, timezone, expires_at) VALUES (?, ?, ?, ?)`,
        args: [await sha256Hex(code), userId, timezone, expiresAt],
      },
    ],
    "write",
  );
  return code;
}

/** Гасит код и возвращает, чей он. null — кода нет, истёк или уже использован. */
export async function consumeLinkCode(
  code: string,
): Promise<{ userId: string; timezone: string } | null> {
  if (!/^[0-9a-f]{32}$/.test(code)) return null;
  const hash = await sha256Hex(code);
  const client = await db();
  const result = await client.execute({
    sql: `DELETE FROM telegram_link_codes WHERE code_hash = ? AND expires_at > ?
          RETURNING user_id, timezone`,
    args: [hash, new Date().toISOString()],
  });
  const row = result.rows[0];
  return row ? { userId: str(row, "user_id"), timezone: str(row, "timezone") || DEFAULT_TIME_ZONE } : null;
}

/**
 * Привязывает чат к аккаунту. Чат, который был привязан к другому аккаунту,
 * переезжает (один чат — один аккаунт); у аккаунта, который уже был привязан к
 * другому чату, чат заменяется, настройки сводки сохраняются.
 */
export async function linkChat(
  userId: string,
  chat: { chatId: string; username: string; firstName: string },
  timezone: string,
): Promise<void> {
  const client = await db();
  await client.batch(
    [
      { sql: `DELETE FROM telegram_links WHERE chat_id = ? AND user_id <> ?`, args: [chat.chatId, userId] },
      {
        sql: `INSERT INTO telegram_links (user_id, chat_id, username, first_name, timezone, linked_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(user_id) DO UPDATE SET
                chat_id = excluded.chat_id,
                username = excluded.username,
                first_name = excluded.first_name,
                timezone = excluded.timezone,
                linked_at = excluded.linked_at`,
        args: [userId, chat.chatId, chat.username, chat.firstName, timezone, new Date().toISOString()],
      },
    ],
    "write",
  );
}

export async function unlinkUser(userId: string): Promise<void> {
  const client = await db();
  await client.execute({ sql: `DELETE FROM telegram_links WHERE user_id = ?`, args: [userId] });
}

export async function updateDigestSettings(
  userId: string,
  settings: { enabled: boolean; time: string; timezone: string },
): Promise<boolean> {
  const client = await db();
  const result = await client.execute({
    sql: `UPDATE telegram_links SET digest_enabled = ?, digest_time = ?, timezone = ? WHERE user_id = ?`,
    args: [settings.enabled ? 1 : 0, settings.time, settings.timezone, userId],
  });
  return result.rowsAffected > 0;
}

export async function markDigestSent(userId: string, localDate: string): Promise<void> {
  const client = await db();
  await client.execute({
    sql: `UPDATE telegram_links SET last_digest_date = ? WHERE user_id = ?`,
    args: [localDate, userId],
  });
}

// ─── Журнал ──────────────────────────────────────────────────────────────────

export type BotInputKind = "text" | "voice" | "command" | "callback" | "other";
export type BotResultKind = "task" | "event" | "expense" | "note" | "none" | "error";

/**
 * Занимает update_id. false — это обновление уже обрабатывалось (Telegram
 * повторил доставку), и второй раз его трогать нельзя: иначе задача запишется
 * дважды.
 */
export async function claimUpdate(
  updateId: number,
  userId: string | null,
  inputKind: BotInputKind,
): Promise<boolean> {
  const client = await db();
  const result = await client.execute({
    sql: `INSERT OR IGNORE INTO bot_events (update_id, user_id, received_at, input_kind) VALUES (?, ?, ?, ?)`,
    args: [updateId, userId, new Date().toISOString(), inputKind],
  });
  return result.rowsAffected > 0;
}

export async function completeUpdate(
  updateId: number,
  outcome: { usedAi: boolean; resultKind: BotResultKind; resultId?: string; summary?: string },
): Promise<void> {
  const client = await db();
  await client.execute({
    sql: `UPDATE bot_events SET used_ai = ?, result_kind = ?, result_id = ?, summary = ? WHERE update_id = ?`,
    args: [
      outcome.usedAi ? 1 : 0,
      outcome.resultKind,
      outcome.resultId ?? "",
      (outcome.summary ?? "").slice(0, 200),
      updateId,
    ],
  });
}

/** Сколько сообщений пользователя за последние сутки разобрал ИИ. */
export async function countAiUsesLastDay(userId: string): Promise<number> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT COUNT(*) AS n FROM bot_events WHERE user_id = ? AND used_ai = 1 AND received_at > ?`,
    args: [userId, new Date(Date.now() - 24 * 3600_000).toISOString()],
  });
  const row = result.rows[0];
  return row ? num(row, "n") : 0;
}

export interface BotEventItem {
  updateId: number;
  receivedAt: string;
  inputKind: BotInputKind;
  resultKind: BotResultKind;
  summary: string;
  undone: boolean;
}

/** Последние записи бота — для блока «Недавно из Telegram» в настройках. */
export async function listRecentBotEvents(userId: string, limit = 6): Promise<BotEventItem[]> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT update_id, received_at, input_kind, result_kind, summary, undone
            FROM bot_events
           WHERE user_id = ? AND result_kind IN ('task', 'event', 'expense', 'note')
           ORDER BY received_at DESC
           LIMIT ?`,
    args: [userId, limit],
  });
  return result.rows.map((row) => ({
    updateId: num(row, "update_id"),
    receivedAt: str(row, "received_at"),
    inputKind: str(row, "input_kind") as BotInputKind,
    resultKind: str(row, "result_kind") as BotResultKind,
    summary: str(row, "summary"),
    undone: bool(row, "undone"),
  }));
}

const RECORD_TABLES = { task: "tasks", event: "events", expense: "expenses", note: "notes" } as const;
export type RecordKind = keyof typeof RECORD_TABLES;

/**
 * «Отменить» под сообщением бота: удаляет запись, которую создало именно это
 * обновление, и только если она принадлежит этому пользователю. Возвращает
 * тип записи — чтобы обновить нужную страницу — или null, если отменять нечего.
 */
export async function undoBotEvent(
  userId: string,
  updateId: number,
): Promise<{ kind: RecordKind; summary: string } | null> {
  const client = await db();
  const found = await client.execute({
    sql: `SELECT result_kind, result_id, summary, undone FROM bot_events WHERE update_id = ? AND user_id = ?`,
    args: [updateId, userId],
  });
  const row = found.rows[0];
  if (!row || bool(row, "undone")) return null;

  const kind = str(row, "result_kind");
  if (!(kind in RECORD_TABLES)) return null;
  const table = RECORD_TABLES[kind as RecordKind];

  await client.batch(
    [
      { sql: `DELETE FROM ${table} WHERE id = ? AND user_id = ?`, args: [str(row, "result_id"), userId] },
      { sql: `UPDATE bot_events SET undone = 1 WHERE update_id = ? AND user_id = ?`, args: [updateId, userId] },
    ],
    "write",
  );
  return { kind: kind as RecordKind, summary: str(row, "summary") };
}
