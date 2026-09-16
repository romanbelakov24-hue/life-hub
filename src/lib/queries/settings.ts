import "server-only";

import { db } from "@/lib/db/client";
import { str } from "@/lib/db/rows";
import { safeEqual } from "@/lib/utils/token";

/**
 * Настройки приложения — таблица ключ-значение, теперь на пользователя.
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

/** Ключ токена приёма данных здоровья от «Быстрых команд». */
export const HEALTH_TOKEN_KEY = "health_import_token";

/** Ключ SHA-256-хеша токена агента KAIROS (сам токен не хранится). */
export const AGENT_TOKEN_HASH_KEY = "agent_token_sha256";

export async function getSetting(userId: string, key: string): Promise<string | null> {
  const client = await db();
  const result = await client.execute({
    sql: `SELECT value FROM settings WHERE user_id = ? AND key = ?`,
    args: [userId, key],
  });

  const row = result.rows[0];
  return row ? str(row, "value") : null;
}

export async function setSetting(userId: string, key: string, value: string): Promise<void> {
  const client = await db();
  await client.execute({
    sql: `INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?)
          ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`,
    args: [userId, key, value],
  });
}

/**
 * Находит владельца токена среди всех настроек с данным ключом.
 *
 * Публичные роуты (лента календаря, вебхук здоровья, страница-сводка) не
 * знают заранее, чей это токен — сравнение с одним ожидаемым значением, как
 * было в однопользовательском режиме, здесь не подходит. Строк с одним ключом
 * (`calendar_feed_token` и т.п.) ровно столько, сколько пользователей — на
 * масштабе личного приложения это единицы, полный перебор с сравнением за
 * постоянное время (safeEqual) на каждую строку не медленнее и не хуже с точки
 * зрения тайминг-атак, чем один SELECT ... WHERE value = ?, зато не сравнивает
 * секрет через некостантное время в самой базе.
 */
export async function findUserIdByToken(key: string, token: string): Promise<string | null> {
  if (!token) return null;

  const client = await db();
  const result = await client.execute({
    sql: `SELECT user_id, value FROM settings WHERE key = ?`,
    args: [key],
  });

  for (const row of result.rows) {
    if (safeEqual(str(row, "value"), token)) {
      return str(row, "user_id") || null;
    }
  }

  return null;
}

/** 32 hex-символа — 128 бит случайности, перебором не находится. */
function createFeedToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "").slice(0, 32);
}

/**
 * Токен календарной ленты. Создаётся при первом обращении.
 *
 * Он же — единственная защита ленты: URL знает только владелец. Поэтому токен
 * длинный и случайный, а не производный от чего-то угадываемого. Сменить его
 * (и тем самым отозвать все существующие подписки) можно через
 * `rotateCalendarToken`.
 */
export async function getOrCreateCalendarToken(userId: string): Promise<string> {
  const existing = await getSetting(userId, CALENDAR_TOKEN_KEY);
  if (existing) return existing;

  const token = createFeedToken();
  await setSetting(userId, CALENDAR_TOKEN_KEY, token);
  return token;
}

export async function rotateCalendarToken(userId: string): Promise<string> {
  const token = createFeedToken();
  await setSetting(userId, CALENDAR_TOKEN_KEY, token);
  return token;
}

// ─── Публичная сводка ────────────────────────────────────────────────────────

/**
 * Токен страницы-сводки. Как и у календаря — создаётся при первом обращении.
 *
 * Наличие токена ещё не означает, что страница открыта: за это отвечает
 * отдельный флаг. Так ссылку можно подготовить и скопировать заранее, а
 * доступ включить и выключить в один клик, не меняя адрес.
 */
export async function getOrCreateShareToken(userId: string): Promise<string> {
  const existing = await getSetting(userId, SHARE_TOKEN_KEY);
  if (existing) return existing;

  const token = createFeedToken();
  await setSetting(userId, SHARE_TOKEN_KEY, token);
  return token;
}

export async function rotateShareToken(userId: string): Promise<string> {
  const token = createFeedToken();
  await setSetting(userId, SHARE_TOKEN_KEY, token);
  return token;
}

export async function isShareEnabled(userId: string): Promise<boolean> {
  // По умолчанию выключено: публичный доступ включается осознанно.
  return (await getSetting(userId, SHARE_ENABLED_KEY)) === "1";
}

export async function setShareEnabled(userId: string, enabled: boolean): Promise<void> {
  await setSetting(userId, SHARE_ENABLED_KEY, enabled ? "1" : "0");
}

// ─── Приём данных здоровья ───────────────────────────────────────────────────

/**
 * Токен вебхука здоровья. Как и у календаря — единственная защита: это
 * приёмный адрес для POST-запросов от автоматизации на телефоне, у него нет
 * отдельного флага включения, потому что знание непредсказуемого токена уже
 * и есть допуск (тот же принцип, что у ленты календаря).
 */
export async function getOrCreateHealthToken(userId: string): Promise<string> {
  const existing = await getSetting(userId, HEALTH_TOKEN_KEY);
  if (existing) return existing;

  const token = createFeedToken();
  await setSetting(userId, HEALTH_TOKEN_KEY, token);
  return token;
}

export async function rotateHealthToken(userId: string): Promise<string> {
  const token = createFeedToken();
  await setSetting(userId, HEALTH_TOKEN_KEY, token);
  return token;
}

// ─── Токен агента ────────────────────────────────────────────────────────────

/**
 * Токен агента устроен иначе, чем токены выше, и намеренно.
 *
 * Лента календаря, сводка и вебхук здоровья хранят токен как есть: он входит в
 * адрес, который владелец должен иметь возможность снова открыть и скопировать,
 * а утечка даёт в худшем случае чтение одной ленты или запись шагов. Токен
 * агента даёт запись в задачи, траты, календарь и заметки — это ключ API.
 * Поэтому в базе лежит только его SHA-256: утечка дампа базы не даёт доступа,
 * а сам токен показывается один раз при выпуске (как ключи у GitHub или
 * Anthropic) и восстановить его нельзя — только выпустить новый.
 *
 * Префикс lh_agent_ нужен сканерам секретов: по нему случайно закоммиченный
 * токен узнаётся с первого взгляда. Тело — 40 hex-символов, 160 бит.
 */

const AGENT_TOKEN_PREFIX = "lh_agent_";

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createAgentToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${AGENT_TOKEN_PREFIX}${hex}`;
}

/** Выпускает новый токен агента (старый перестаёт работать) и возвращает его — единственный раз. */
export async function issueAgentToken(userId: string): Promise<string> {
  const token = createAgentToken();
  await setSetting(userId, AGENT_TOKEN_HASH_KEY, await sha256Hex(token));
  return token;
}

export async function hasAgentToken(userId: string): Promise<boolean> {
  return (await getSetting(userId, AGENT_TOKEN_HASH_KEY)) !== null;
}

/** Отзывает доступ агента целиком. */
export async function revokeAgentToken(userId: string): Promise<void> {
  const client = await db();
  await client.execute({
    sql: `DELETE FROM settings WHERE user_id = ? AND key = ?`,
    args: [userId, AGENT_TOKEN_HASH_KEY],
  });
}

/**
 * Владелец токена агента или null. Сравнивается хеш предъявленного токена с
 * сохранёнными хешами — тем же перебором за постоянное время, что и
 * findUserIdByToken. Токен без префикса отсекается сразу, без обращения к базе.
 */
export async function findUserIdByAgentToken(token: string): Promise<string | null> {
  if (!token.startsWith(AGENT_TOKEN_PREFIX)) return null;
  return findUserIdByToken(AGENT_TOKEN_HASH_KEY, await sha256Hex(token));
}
