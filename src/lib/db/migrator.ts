import type { Client } from "@libsql/client";

import {
  LEGACY_ALTER_STATEMENTS,
  LEGACY_POST_ALTER_STATEMENTS,
  LEGACY_SCHEMA_STATEMENTS,
  LEGACY_SEED_STATEMENTS,
} from "./legacy-schema";
import { MIGRATIONS, type Migration } from "./schema";

/**
 * Применение версионных миграций из schema.ts.
 *
 * Без "server-only": модуль нужен и скриптам (scripts/migrate.ts,
 * scripts/seed-demo.ts), и тестам, и dev-серверу (db/client.ts).
 *
 * Три состояния базы:
 *  • пустая — создаётся schema_migrations и прогоняются все миграции;
 *  • «доверсионная» (таблицы есть, schema_migrations нет — прод до 18.09.2026) —
 *    один раз прогоняется старый конвейер из legacy-schema.ts, который доводит
 *    её до итоговой формы, и она помечается версией 1 без выполнения самой
 *    версии 1 (таблицы уже есть);
 *  • версионная — выполняются только недостающие миграции.
 *
 * Каждая миграция идёт через client.migrate(): это одна транзакция с
 * отключёнными на её время внешними ключами (иначе пересборка таблицы, на
 * которую кто-то ссылается, упала бы на DROP TABLE). Метод не описан в
 * документации, но есть и у локального, и у HTTP-клиента: оба откатывают всю
 * транзакцию при ошибке. Номер версии пишется в той же транзакции — миграция
 * либо применена целиком и записана, либо не применена вовсе.
 */

const MIGRATIONS_TABLE = "schema_migrations";

/** Таблица, по которой узнаётся «доверсионная» база: она была в ней всегда. */
const LEGACY_MARKER_TABLE = "expenses";

type MigratableClient = Client & {
  migrate: (statements: Parameters<Client["batch"]>[0]) => Promise<unknown>;
};

export interface MigrationStatus {
  /** База без schema_migrations, но с данными — нужен разовый перевод на версии. */
  legacyBaselineNeeded: boolean;
  applied: number[];
  pending: Migration[];
  /** Версии, которые есть в базе, но неизвестны этому коду — база новее кода. */
  unknown: number[];
}

export interface MigrateOptions {
  migrations?: Migration[];
  log?: (message: string) => void;
}

function asMigratable(client: Client): MigratableClient {
  const candidate = client as MigratableClient;
  if (typeof candidate.migrate !== "function") {
    throw new Error(
      "client.migrate() недоступен в этой версии @libsql/client — без него " +
        "миграции не выполняются одной транзакцией с отключёнными внешними ключами.",
    );
  }
  return candidate;
}

/** Номера идут подряд с единицы — иначе порядок применения был бы неоднозначен. */
export function assertMigrationList(migrations: Migration[]): void {
  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new Error(
        `Миграция «${migration.name}» имеет номер ${migration.version}, ожидался ${index + 1}. ` +
          "Номера идут подряд с единицы, новые — только в конец списка.",
      );
    }
    if (migration.up.length === 0) {
      throw new Error(`Миграция ${migration.version} «${migration.name}» пустая.`);
    }
  });
}

async function listTables(client: Client): Promise<Set<string>> {
  const result = await client.execute(`SELECT name FROM sqlite_master WHERE type = 'table'`);
  return new Set(result.rows.map((row) => String(row.name)));
}

export async function readMigrationStatus(
  client: Client,
  migrations: Migration[] = MIGRATIONS,
): Promise<MigrationStatus> {
  assertMigrationList(migrations);
  const tables = await listTables(client);

  if (!tables.has(MIGRATIONS_TABLE)) {
    const legacy = tables.has(LEGACY_MARKER_TABLE);
    return {
      legacyBaselineNeeded: legacy,
      applied: [],
      // Для доверсионной базы версия 1 закрывается переводом, а не выполнением.
      pending: legacy ? migrations.filter((m) => m.version > 1) : migrations,
      unknown: [],
    };
  }

  const result = await client.execute(`SELECT version FROM ${MIGRATIONS_TABLE} ORDER BY version`);
  const applied = result.rows.map((row) => Number(row.version));
  const appliedSet = new Set(applied);
  const known = new Set(migrations.map((m) => m.version));

  return {
    legacyBaselineNeeded: false,
    applied,
    pending: migrations.filter((m) => !appliedSet.has(m.version)),
    unknown: applied.filter((version) => !known.has(version)),
  };
}

const CREATE_MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
  version    INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  applied_at TEXT NOT NULL
)`;

function recordVersion(migration: Pick<Migration, "version" | "name">) {
  return {
    sql: `INSERT INTO ${MIGRATIONS_TABLE} (version, name, applied_at) VALUES (?, ?, ?)`,
    args: [migration.version, migration.name, new Date().toISOString()],
  };
}

/**
 * Старый конвейер: SCHEMA → ALTER → пересборки → базовые категории. Каждый шаг
 * идемпотентен, поэтому он доводит до итоговой формы и базу, прошедшую его
 * лишь частично (например, прод, где не прогнали последнюю миграцию).
 */
export async function runLegacyPipeline(client: Client): Promise<void> {
  await client.batch(LEGACY_SCHEMA_STATEMENTS, "write");

  for (const statement of LEGACY_ALTER_STATEMENTS) {
    try {
      await client.execute(statement);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("duplicate column name")) throw error;
    }
  }

  await asMigratable(client).migrate(LEGACY_POST_ALTER_STATEMENTS);
  await client.batch(LEGACY_SEED_STATEMENTS, "write");
}

/** Доводит базу до последней версии. Возвращает номера применённых миграций. */
export async function migrateDatabase(
  client: Client,
  { migrations = MIGRATIONS, log = () => {} }: MigrateOptions = {},
): Promise<{ baselined: boolean; applied: number[] }> {
  const status = await readMigrationStatus(client, migrations);

  if (status.unknown.length > 0) {
    throw new Error(
      `В базе применены миграции ${status.unknown.join(", ")}, которых нет в этом коде — ` +
        "база новее кода. Обнови код (git pull) и повтори.",
    );
  }

  const migratable = asMigratable(client);
  let baselined = false;

  if (status.legacyBaselineNeeded) {
    log("База без версий: довожу её старым конвейером и помечаю версией 1.");
    await runLegacyPipeline(client);
    const first = migrations[0];
    if (first) {
      await migratable.migrate([
        CREATE_MIGRATIONS_TABLE,
        recordVersion({ version: first.version, name: `${first.name} (перевод на версии)` }),
      ]);
    }
    baselined = true;
  } else {
    await client.execute(CREATE_MIGRATIONS_TABLE);
  }

  const applied: number[] = [];
  for (const migration of status.pending) {
    log(`Миграция ${migration.version} «${migration.name}»…`);
    await migratable.migrate([...migration.up, recordVersion(migration)]);
    applied.push(migration.version);
  }

  return { baselined, applied };
}
