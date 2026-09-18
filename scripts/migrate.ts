/**
 * Миграции базы.
 *
 *   npm run db:migrate          — локальный ./local.db (dev-сервер делает это и сам)
 *   npm run db:migrate:prod     — боевая Turso
 *   npm run db:status:prod      — только показать, что не применено; код выхода 1,
 *                                 если есть неприменённые (так cf:deploy не даёт
 *                                 выкатить код раньше схемы)
 *
 * Ключи боевой базы берутся из .env.prod.local — этот файл не читают ни Next.js,
 * ни сборка под Cloudflare, так что ключи не попадают ни в dev-сервер, ни в код
 * воркера. Пока ключи ещё лежат в .env.local (как было до 18.09.2026), --prod
 * берёт их оттуда.
 */

import { createClient, type Client } from "@libsql/client";

import { migrateDatabase, readMigrationStatus } from "../src/lib/db/migrator";
import { LATEST_SCHEMA_VERSION } from "../src/lib/db/schema";
import { loadEnvFile } from "./lib/env";

const args = new Set(process.argv.slice(2));
const PROD = args.has("--prod");
const CHECK_ONLY = args.has("--check");

function openClient(): { client: Client; label: string } {
  if (!PROD) {
    return { client: createClient({ url: "file:local.db" }), label: "локальный файл ./local.db" };
  }

  loadEnvFile(".env.prod.local");
  loadEnvFile(".env.local");
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error(
      "Для --prod нужен TURSO_DATABASE_URL (и TURSO_AUTH_TOKEN) в .env.prod.local.",
    );
  }
  return {
    client: createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN }),
    label: `боевая база ${new URL(url).host}`,
  };
}

async function main(): Promise<void> {
  const { client, label } = openClient();
  console.log(`База: ${label}`);

  if (CHECK_ONLY) {
    const status = await readMigrationStatus(client);
    if (status.unknown.length > 0) {
      console.error(`В базе есть миграции новее кода: ${status.unknown.join(", ")}.`);
      process.exit(1);
    }
    if (status.legacyBaselineNeeded || status.pending.length > 0) {
      const names = status.pending.map((m) => `${m.version} «${m.name}»`);
      if (status.legacyBaselineNeeded) names.unshift("перевод на версии");
      console.error(`Не применено: ${names.join(", ")}.`);
      console.error(PROD ? "Запусти: npm run db:migrate:prod" : "Запусти: npm run db:migrate");
      process.exit(1);
    }
    console.log(`Схема актуальна: версия ${LATEST_SCHEMA_VERSION}.`);
    return;
  }

  const result = await migrateDatabase(client, { log: (message) => console.log(message) });
  if (!result.baselined && result.applied.length === 0) {
    console.log(`Нечего применять: схема уже на версии ${LATEST_SCHEMA_VERSION}.`);
  } else {
    console.log(`Готово: схема на версии ${LATEST_SCHEMA_VERSION}.`);
  }
}

main().catch((error) => {
  console.error("Миграция не выполнена:", error instanceof Error ? error.message : error);
  process.exit(1);
});
