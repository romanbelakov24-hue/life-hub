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
    // В продакшне откат на файл недопустим: на Vercel файловая система
    // эфемерна и доступна только для чтения, поэтому сайт выглядел бы рабочим,
    // но терял бы каждую запись. Лучше сразу упасть с понятным сообщением —
    // его покажет src/app/error.tsx.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Не задана переменная окружения TURSO_DATABASE_URL. " +
          "Добавьте её и TURSO_AUTH_TOKEN в настройках проекта на хостинге.",
      );
    }

    // В разработке — локальный SQLite-файл: данные не синхронизируются между
    // устройствами, но приложение полностью работоспособно без учётной записи.
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
