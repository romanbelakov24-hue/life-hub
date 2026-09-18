import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";

import { createClient, type Client } from "@libsql/client";

import { LEGACY_SCHEMA_STATEMENTS } from "./legacy-schema";
import {
  assertMigrationList,
  migrateDatabase,
  readMigrationStatus,
  runLegacyPipeline,
} from "./migrator";
import { MIGRATIONS, type Migration } from "./schema";

/**
 * Базы — во временных файлах, а не в :memory:: локальный клиент libSQL может
 * открыть новое соединение, и у «памяти» оно было бы пустой базой.
 */
const workDir = mkdtempSync(join(tmpdir(), "life-hub-migrations-"));
const clients: Client[] = [];
let counter = 0;

function freshClient(): Client {
  counter += 1;
  const client = createClient({ url: `file:${join(workDir, `db-${counter}.db`)}` });
  clients.push(client);
  return client;
}

after(() => {
  for (const client of clients) client.close();
  // На Windows файл базы иногда ещё занят сразу после close() — временная папка
  // тогда остаётся, это не повод ронять прогон.
  try {
    rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {
    // пусть почистит система
  }
});

const normalize = (sql: unknown) => String(sql ?? "").replace(/\s+/g, " ").trim();

/**
 * Всё, что определяет поведение схемы: колонки (тип, NOT NULL, DEFAULT, место в
 * ключе), внешние ключи и индексы (уникальность, колонки, условие частичного).
 * Порядок колонок тоже важен — от него зависит SELECT * и INSERT без списка.
 */
async function describeSchema(client: Client): Promise<Record<string, unknown>> {
  const tables = await client.execute(
    `SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'schema_migrations'
      ORDER BY name`,
  );
  const description: Record<string, unknown> = {};

  for (const row of tables.rows) {
    const table = String(row.name);
    const columns = await client.execute(`PRAGMA table_info("${table}")`);
    const foreignKeys = await client.execute(`PRAGMA foreign_key_list("${table}")`);
    const indexes = await client.execute(
      `SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL ORDER BY name`,
      [table],
    );

    description[table] = {
      columns: columns.rows.map((c) => [c.name, c.type, c.notnull, c.dflt_value, c.pk]),
      foreignKeys: foreignKeys.rows.map((f) => [f.table, f.from, f.to, f.on_delete]),
      indexes: indexes.rows.map((i) => [i.name, normalize(i.sql)]),
    };
  }
  return description;
}

describe("список миграций", () => {
  it("номера идут подряд с единицы", () => {
    assert.doesNotThrow(() => assertMigrationList(MIGRATIONS));
  });

  it("ловит пропуск номера", () => {
    const broken: Migration[] = [
      { version: 1, name: "a", up: ["SELECT 1"] },
      { version: 3, name: "b", up: ["SELECT 1"] },
    ];
    assert.throws(() => assertMigrationList(broken), /ожидался 2/);
  });
});

describe("версия 1", () => {
  it("создаёт ровно ту схему, до которой прод довёл старый конвейер", async () => {
    const legacy = freshClient();
    await runLegacyPipeline(legacy);

    const versioned = freshClient();
    await migrateDatabase(versioned, { migrations: MIGRATIONS.slice(0, 1) });

    assert.deepEqual(await describeSchema(versioned), await describeSchema(legacy));
  });
});

describe("доверсионная база", () => {
  it("переводится на версии без потери данных и без повторной версии 1", async () => {
    const client = freshClient();
    // Состояние «до многопользовательского режима»: только первый шаг конвейера.
    await client.batch(LEGACY_SCHEMA_STATEMENTS, "write");
    await client.execute(
      `INSERT INTO categories (id, name, color, icon, is_default, sort_order)
       VALUES ('cat_x', 'Кофе', '#000000', 'tag', 0, 5)`,
    );
    await client.execute(
      `INSERT INTO expenses (id, date, category_id, note, amount, created_at)
       VALUES ('exp_1', '2026-09-01', 'cat_x', 'латте', 250, '2026-09-01T10:00:00Z')`,
    );

    const status = await readMigrationStatus(client);
    assert.equal(status.legacyBaselineNeeded, true);

    const result = await migrateDatabase(client);
    assert.equal(result.baselined, true);
    assert.deepEqual(result.applied, MIGRATIONS.slice(1).map((m) => m.version));

    const expense = await client.execute(`SELECT amount, note, user_id FROM expenses WHERE id = 'exp_1'`);
    assert.equal(expense.rows[0]?.amount, 250);
    assert.equal(expense.rows[0]?.note, "латте");

    // Колонки, которые старый конвейер уже дважды чуть не потерял при пересборке.
    await client.execute(`UPDATE categories SET monthly_limit = 3000 WHERE id = 'cat_x'`);
    await client.execute(
      `INSERT INTO health_daily (user_id, date, screen_time_minutes, updated_at)
       VALUES ('u1', '2026-09-01', 185, '2026-09-01T10:00:00Z')`,
    );

    const again = await migrateDatabase(client);
    assert.equal(again.baselined, false);
    assert.deepEqual(again.applied, []);

    const category = await client.execute(`SELECT monthly_limit FROM categories WHERE id = 'cat_x'`);
    assert.equal(category.rows[0]?.monthly_limit, 3000);
    const health = await client.execute(`SELECT screen_time_minutes FROM health_daily`);
    assert.equal(health.rows[0]?.screen_time_minutes, 185);
  });
});

describe("применение", () => {
  it("пустая база доводится до последней версии, повторный запуск ничего не делает", async () => {
    const client = freshClient();
    const first = await migrateDatabase(client);
    assert.deepEqual(first.applied, MIGRATIONS.map((m) => m.version));

    const status = await readMigrationStatus(client);
    assert.deepEqual(status.pending, []);
    assert.deepEqual((await migrateDatabase(client)).applied, []);
  });

  it("упавшая миграция откатывается целиком и не записывается", async () => {
    const client = freshClient();
    const migrations: Migration[] = [
      ...MIGRATIONS,
      {
        version: MIGRATIONS.length + 1,
        name: "broken",
        up: [`CREATE TABLE half_done (id TEXT)`, `INSERT INTO no_such_table VALUES (1)`],
      },
    ];

    await assert.rejects(migrateDatabase(client, { migrations }));

    const tables = await client.execute(`SELECT name FROM sqlite_master WHERE name = 'half_done'`);
    assert.equal(tables.rows.length, 0, "таблица из упавшей миграции осталась");
    const status = await readMigrationStatus(client, migrations);
    assert.deepEqual(
      status.pending.map((m) => m.name),
      ["broken"],
    );
  });

  it("отказывается работать, если база новее кода", async () => {
    const client = freshClient();
    await migrateDatabase(client);
    await client.execute(
      `INSERT INTO schema_migrations (version, name, applied_at) VALUES (999, 'future', '2030-01-01')`,
    );
    await assert.rejects(migrateDatabase(client), /база новее кода/);
  });
});
