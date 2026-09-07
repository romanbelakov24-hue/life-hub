/**
 * Ручная миграция базы: `npm run db:migrate`.
 *
 * Приложение создаёт схему само при первом запросе, поэтому скрипт нужен
 * в двух случаях:
 *   • подготовить свежую базу Turso до первого деплоя;
 *   • применить ALTER_STATEMENTS / POST_ALTER_STATEMENTS после изменения схемы.
 *
 * Запускается через tsx с загрузкой .env.local, чтобы видеть те же переменные,
 * что и Next.js.
 *
 * ⚠️ POST_ALTER_STATEMENTS (многопользовательский режим) ломает старый код —
 * см. предупреждение в db/schema.ts. Запускать этот скрипт на проде можно
 * только вместе с деплоем новой версии приложения, не раньше и не позже.
 */

import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  ALTER_STATEMENTS,
  POST_ALTER_STATEMENTS,
  SCHEMA_STATEMENTS,
  SEED_STATEMENTS,
} from "../src/lib/db/schema";

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

  // Индексы и пересборки таблиц, которым нужны только что добавленные колонки.
  //
  // Через client.migrate(), а не client.batch(): часть этих операций пересоздаёт
  // categories, на которую ссылается внешний ключ expenses.category_id — обычный
  // batch() выполняет свои операторы внутри одной транзакции, а SQLite проверяет
  // внешние ключи и внутри неё, так что DROP TABLE упал бы с
  // SQLITE_CONSTRAINT_FOREIGNKEY. migrate() — недокументированный, но реально
  // существующий метод клиента (используется им самим для той же задачи
  // внутри пакета): он отключает проверку внешних ключей на время операций и
  // включает её обратно. Прямо протестировано против локальной и настоящей
  // Turso-базы перед тем, как полагаться на него здесь.
  if (POST_ALTER_STATEMENTS.length > 0) {
    const migratableClient = client as unknown as {
      migrate: (statements: string[]) => Promise<unknown>;
    };
    if (typeof migratableClient.migrate !== "function") {
      throw new Error(
        "client.migrate() недоступен в этой версии @libsql/client — " +
          "POST_ALTER_STATEMENTS пересобирают таблицы со внешними ключами " +
          "и не могут идти через обычный batch().",
      );
    }
    await migratableClient.migrate(POST_ALTER_STATEMENTS);
    console.log(`Операций после ALTER: ${POST_ALTER_STATEMENTS.length}.`);
  }

  await client.batch(SEED_STATEMENTS, "write");
  console.log("Базовые категории на месте.");

  console.log("Миграция завершена.");
}

main().catch((error) => {
  console.error("Миграция не выполнена:", error);
  process.exit(1);
});
