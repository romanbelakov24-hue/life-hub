import type { Client } from "@libsql/client";

/**
 * Единственная точка подключения к базе.
 *
 * Продакшн (сайт на Cloudflare, `next start`) — Turso по TURSO_DATABASE_URL +
 * TURSO_AUTH_TOKEN. Разработка (`next dev`) — ВСЕГДА локальный файл ./local.db,
 * даже если в .env.local лежат ключи боевой базы: раньше dev-сервер по
 * умолчанию писал в прод, и локальные проверки приходилось делать, подменяя
 * .env.local, — одна забытая подмена, и тестовые записи уезжали к живым данным.
 * Боевую базу из командной строки трогают только скрипты с явным --prod.
 *
 * Схема на проде в рантайме не создаётся и не проверяется: её доводит
 * `npm run db:migrate:prod` до деплоя (cf:deploy сам проверяет, что миграции
 * применены). Раньше каждый холодный старт сначала отправлял в базу весь DDL
 * схемы — лишний круг до базы в другом регионе на самом частом пути. В
 * разработке миграции применяются сами при первом обращении: пустой local.db
 * готов к работе без отдельной команды.
 *
 * Драйвер выбирается явно:
 *   • для удалённой базы — `@libsql/client/web` на обычном fetch, без
 *     нативного модуля (на Workers его нет);
 *   • для ./local.db — node-сборка, только она умеет локальный SQLite.
 */

/** Кэш в globalThis — переживает hot-reload в dev-режиме Next.js. */
const globalForDb = globalThis as unknown as {
  __lifeHubClient?: Promise<Client>;
};

async function createRemoteClient(): Promise<Client> {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error(
      "Не задана переменная окружения TURSO_DATABASE_URL. " +
        "На Cloudflare она задаётся секретом: npx wrangler secret put TURSO_DATABASE_URL.",
    );
  }
  const { createClient } = await import("@libsql/client/web");
  return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
}

async function createLocalClient(): Promise<Client> {
  // Импорт спрятан внутри Function(...), а не написан обычным `import(...)`:
  // и webpack (next dev/build), и esbuild (сборка под Cloudflare Workers через
  // OpenNext) статически разбирают обычный динамический импорт и пытаются
  // подключить его в бандл заранее — а node-сборка @libsql/client тянет
  // зависимость с условным экспортом "workerd", которую попытка забандлить эту
  // ветку просто ломает. Через Function(...) импорт рождается только в
  // рантайме, и оба бандлера оставляют обычный import() Node.js.
  const importNodeOnly = new Function(
    "specifier",
    "return import(specifier)",
  ) as (specifier: string) => Promise<typeof import("@libsql/client")>;
  const { createClient } = await importNodeOnly("@libsql/client");
  const client = createClient({ url: "file:local.db" });

  const { migrateDatabase } = await import("./migrator");
  await migrateDatabase(client, { log: (message) => console.log(`[db] ${message}`) });
  return client;
}

async function createDbClient(): Promise<Client> {
  return process.env.NODE_ENV === "production" ? createRemoteClient() : createLocalClient();
}

/** Клиент базы. Использовать во всех queries/* и actions/*. */
export async function db(): Promise<Client> {
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
