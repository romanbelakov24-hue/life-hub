/**
 * Ручная миграция базы: `npm run db:migrate`.
 *
 * Приложение создаёт схему само при первом запросе, поэтому скрипт нужен
 * в двух случаях:
 *   • подготовить свежую базу Turso до первого деплоя;
 *   • применить ALTER_STATEMENTS после того, как в схему добавили колонку.
 *
 * Запускается через tsx с загрузкой .env.local, чтобы видеть те же переменные,
 * что и Next.js.
 */

import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ALTER_STATEMENTS, SCHEMA_STATEMENTS, SEED_STATEMENTS } from "../src/lib/db/schema";

/** Минимальный парсер .env — чтобы не тянуть зависимость ради одного скрипта. */
function loadEnvFile(fileName: string): void {
  try {
    const content = readFileSync(resolve(process.cwd(), fileName), "utf8");

    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Файла нет — работаем с тем, что уже есть в окружении.
  }
}

async function main(): Promise<void> {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  const client = url
    ? createClient({ url, authToken })
    : createClient({ url: "file:local.db" });

  console.log(url ? `База: ${url}` : "База: локальный файл ./local.db");

  await client.batch(SCHEMA_STATEMENTS, "write");
  console.log(`Таблицы и индексы: ${SCHEMA_STATEMENTS.length} операций.`);

  // ALTER выполняем по одному: повторный запуск ожидаемо падает на уже
  // добавленной колонке, и это не ошибка миграции.
  let appliedAlters = 0;
  for (const statement of ALTER_STATEMENTS) {
    try {
      await client.execute(statement);
      appliedAlters += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("duplicate column name")) throw error;
    }
  }
  if (ALTER_STATEMENTS.length > 0) {
    console.log(`Новых колонок добавлено: ${appliedAlters}.`);
  }

  await client.batch(SEED_STATEMENTS, "write");
  console.log("Базовые категории на месте.");

  console.log("Миграция завершена.");
}

main().catch((error) => {
  console.error("Миграция не выполнена:", error);
  process.exit(1);
});
