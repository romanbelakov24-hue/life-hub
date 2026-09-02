import "server-only";

import { db } from "@/lib/db/client";
import { str } from "@/lib/db/rows";

/**
 * Настройки приложения — таблица ключ-значение.
 *
 * Сюда попадает то, что не заслуживает отдельной таблицы: токен календарной
 * ленты, в будущем — параметры уведомлений. Значения хранятся строками;
 * если понадобится структура, кладите JSON и разбирайте на месте чтения.
 */

/** Ключ токена, которым подписывается календарная лента. */
export const CALENDAR_TOKEN_KEY = "calendar_feed_token";

/** Ключ токена публичной страницы-сводки. */
export const SHARE_TOKEN_KEY = "share_summary_token";

/** Включена ли публичная сводка. Хранится строкой "1" / "0". */
export const SHARE_ENABLED_KEY = "share_summary_enabled";

export async function getSetting(key: string): Promise<string | null> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT value FROM settings WHERE key = ?`,
    args: [key],
  });

  const row = result.rows[0];
  return row ? str(row, "value") : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const client = await db();
  await client.execute({
    sql: `INSERT INTO settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: [key, value],
  });
}

/**
 * Токен календарной ленты. Создаётся при первом обращении.
 *
 * Он же — единственная защита ленты: URL знает только владелец. Поэтому токен
 * длинный и случайный, а не производный от чего-то угадываемого. Сменить его
 * (и тем самым отозвать все существующие подписки) можно через
 * `rotateCalendarToken`.
 */
export async function getOrCreateCalendarToken(): Promise<string> {
  const existing = await getSetting(CALENDAR_TOKEN_KEY);
  if (existing) return existing;

  const token = createFeedToken();
  await setSetting(CALENDAR_TOKEN_KEY, token);
  return token;
}

export async function rotateCalendarToken(): Promise<string> {
  const token = createFeedToken();
  await setSetting(CALENDAR_TOKEN_KEY, token);
  return token;
}

/** 32 hex-символа — 128 бит случайности, перебором не находится. */
function createFeedToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "").slice(0, 32);
}

// ─── Публичная сводка ────────────────────────────────────────────────────────

/**
 * Токен страницы-сводки. Как и у календаря — создаётся при первом обращении.
 *
 * Наличие токена ещё не означает, что страница открыта: за это отвечает
 * отдельный флаг. Так ссылку можно подготовить и скопировать заранее, а
 * доступ включить и выключить в один клик, не меняя адрес.
 */
export async function getOrCreateShareToken(): Promise<string> {
  const existing = await getSetting(SHARE_TOKEN_KEY);
  if (existing) return existing;

  const token = createFeedToken();
  await setSetting(SHARE_TOKEN_KEY, token);
  return token;
}

export async function rotateShareToken(): Promise<string> {
  const token = createFeedToken();
  await setSetting(SHARE_TOKEN_KEY, token);
  return token;
}

export async function isShareEnabled(): Promise<boolean> {
  // По умолчанию выключено: публичный доступ включается осознанно.
  return (await getSetting(SHARE_ENABLED_KEY)) === "1";
}

export async function setShareEnabled(enabled: boolean): Promise<void> {
  await setSetting(SHARE_ENABLED_KEY, enabled ? "1" : "0");
}
