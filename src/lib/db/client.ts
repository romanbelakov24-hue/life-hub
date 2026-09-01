import { createClient, type Client } from "@libsql/client";
import { SCHEMA_STATEMENTS, SEED_STATEMENTS } from "./schema";

/**
 * Единственная точка подключения к базе.
 *
 * Продакшн  — Turso (libSQL) по TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
 * Разработка — если переменные не заданы, падаем на локальный файл ./local.db,
 *              чтобы можно было поднять проект без учётной записи Turso.
 *
 * Схема создаётся лениво при первом обращении (CREATE TABLE IF NOT EXISTS),
 * поэтому отдельный шаг миграции для запуска не обязателен.
 */

/** Кэш в globalThis — переживает hot-reload в dev-режиме Next.js. */
const globalForDb = globalThis as unknown as {
  __lifeHubClient?: Client;
  __lifeHubSchemaReady?: Promise<void>;
};

function createDbClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    // Локальный SQLite-файл: данные не синхронизируются между устройствами,
    // но приложение полностью работоспособно.
    return createClient({ url: "file:local.db" });
  }

  return createClient({ url, authToken });
}

/** Низкоуровневый клиент без гарантии, что схема создана. */
export function getClient(): Client {
  if (!globalForDb.__lifeHubClient) {
    globalForDb.__lifeHubClient = createDbClient();
  }
  return globalForDb.__lifeHubClient;
}

/** Создаёт таблицы и базовые категории. Выполняется один раз за процесс. */
export async function ensureSchema(): Promise<void> {
  if (!globalForDb.__lifeHubSchemaReady) {
    globalForDb.__lifeHubSchemaReady = (async () => {
      const client = getClient();
      await client.batch(SCHEMA_STATEMENTS, "write");
      await client.batch(SEED_STATEMENTS, "write");
    })().catch((error) => {
      // Сбрасываем кэш, чтобы следующий запрос попробовал ещё раз,
      // а не завис навсегда на отклонённом промисе.
      globalForDb.__lifeHubSchemaReady = undefined;
      throw error;
    });
  }
  return globalForDb.__lifeHubSchemaReady;
}

/**
 * Основной способ получить клиент: гарантирует готовую схему.
 * Использовать во всех queries/* и actions/*.
 */
export async function db(): Promise<Client> {
  await ensureSchema();
  return getClient();
}

/** Работает ли приложение на удалённой базе Turso (а не на локальном файле). */
export function isRemoteDatabase(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL);
}
