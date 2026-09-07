import type { Client } from "@libsql/client";

import { SCHEMA_STATEMENTS, SEED_STATEMENTS } from "./schema";

/**
 * Единственная точка подключения к базе.
 *
 * Продакшн  — Turso (libSQL) по TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
 * Разработка — если переменные не заданы, локальный файл ./local.db, чтобы
 *              можно было поднять проект без учётной записи Turso.
 *
 * Схема создаётся лениво при первом обращении (CREATE TABLE IF NOT EXISTS),
 * поэтому отдельный шаг миграции для запуска не обязателен.
 *
 * Драйвер выбирается явно, а не автоматически:
 *
 *   • для удалённой базы берётся сборка `@libsql/client/web` — она построена
 *     на обычном fetch и не содержит нативного модуля. Для серверлес-функций
 *     (Netlify, Vercel) это принципиально: нативный бинарник пришлось бы
 *     собирать под платформу рантайма и класть в бандл, а ошибка на этом пути
 *     проявляется только в задеплоенной версии, а не локально;
 *
 *   • для файла ./local.db нужна обычная node-сборка — только она умеет
 *     локальный SQLite. Импорт динамический, поэтому в продакшн этот код
 *     не попадает вовсе.
 */

/** Кэш в globalThis — переживает hot-reload в dev-режиме Next.js. */
const globalForDb = globalThis as unknown as {
  __lifeHubClient?: Promise<Client>;
  __lifeHubSchemaReady?: Promise<void>;
};

async function createDbClient(): Promise<Client> {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url) {
    const { createClient } = await import("@libsql/client/web");
    return createClient({ url, authToken });
  }

  // В продакшне откат на файл недопустим: на серверлес-хостинге файловая
  // система эфемерна и доступна только для чтения, поэтому сайт выглядел бы
  // рабочим, но терял бы каждую запись. Лучше сразу упасть с понятным
  // сообщением — его покажет src/app/error.tsx.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Не задана переменная окружения TURSO_DATABASE_URL. " +
        "Добавьте её и TURSO_AUTH_TOKEN в настройках проекта на хостинге.",
    );
  }

  // В разработке — локальный SQLite-файл: данные не синхронизируются между
  // устройствами, но приложение полностью работоспособно без учётной записи.
  const { createClient } = await import("@libsql/client");
  return createClient({ url: "file:local.db" });
}

/** Клиент без гарантии, что схема создана. Используется только внутри модуля. */
function getClient(): Promise<Client> {
  if (!globalForDb.__lifeHubClient) {
    globalForDb.__lifeHubClient = createDbClient().catch((error: unknown) => {
      // Сбрасываем кэш, чтобы следующий запрос попробовал ещё раз, а не завис
      // навсегда на отклонённом промисе.
      globalForDb.__lifeHubClient = undefined;
      throw error;
    });
  }
  return globalForDb.__lifeHubClient;
}

/**
 * Создаёт таблицы и базовые категории. Выполняется один раз за процесс.
 *
 * DDL и вставка категорий отправляются одним батчем: на серверлес-хостинге
 * это выполняется при каждом холодном старте, а до базы в другом регионе
 * каждое обращение стоит сотни миллисекунд. Один круг вместо двух заметен.
 *
 * SKIP_SCHEMA_INIT=true убирает и этот круг целиком: на личном сайте с одним
 * пользователем функция почти всегда стартует холодной (простаивает между
 * визитами дольше, чем Netlify держит инстанс тёплым), и каждое такое
 * открытие сайта раньше сначала ждало ответа на CREATE TABLE, и только потом
 * запускало настоящие запросы страницы — при живой отдалённой базе это заметная
 * доля общего времени загрузки. Таблицы создаются один раз и не меняются на
 * лету (для новых колонок — scripts/migrate.ts), так что после первого
 * успешного запуска перезапрашивать их существование незачем. Включать переменную
 * только когда таблицы точно уже есть — иначе первый же запрос к отсутствующей
 * таблице упадёт с «no such table».
 */
export async function ensureSchema(): Promise<void> {
  if (process.env.SKIP_SCHEMA_INIT === "true") return;

  if (!globalForDb.__lifeHubSchemaReady) {
    globalForDb.__lifeHubSchemaReady = (async () => {
      const client = await getClient();
      await client.batch([...SCHEMA_STATEMENTS, ...SEED_STATEMENTS], "write");
    })().catch((error: unknown) => {
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
