/**
 * DDL-схема базы и стартовые данные.
 *
 * Правила эволюции схемы (важно для будущих доработок):
 *  • Новая таблица  → добавь CREATE TABLE IF NOT EXISTS в SCHEMA_STATEMENTS.
 *  • Новая колонка  → добавь строку в ALTER_STATEMENTS (ошибка «duplicate
 *    column name» при повторном запуске гасится в migrate.ts и в client.ts).
 *  • Удалять/переименовывать колонки в SQLite дорого — по возможности не делай.
 */

export const SCHEMA_STATEMENTS: string[] = [
  // ─── Расходы ────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS categories (
     id          TEXT PRIMARY KEY,
     name        TEXT NOT NULL UNIQUE,
     color       TEXT NOT NULL DEFAULT '#7e8894',
     icon        TEXT NOT NULL DEFAULT 'tag',
     is_default  INTEGER NOT NULL DEFAULT 0,
     sort_order  INTEGER NOT NULL DEFAULT 100
   )`,

  `CREATE TABLE IF NOT EXISTS expenses (
     id          TEXT PRIMARY KEY,
     date        TEXT NOT NULL,
     category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
     note        TEXT NOT NULL DEFAULT '',
     amount      REAL NOT NULL,
     created_at  TEXT NOT NULL,
     -- Отпечаток строки банковской выписки: дата + сумма + описание.
     -- Пустой у трат, заведённых руками. По нему отсекаются повторные импорты.
     import_key  TEXT NOT NULL DEFAULT ''
   )`,

  // Выборки почти всегда идут по диапазону дат — индекс обязателен.
  `CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id)`,

  // ─── Учебный планер ─────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS schedule_slots (
     id         TEXT PRIMARY KEY,
     weekday    INTEGER NOT NULL,
     pair_index INTEGER NOT NULL,
     subject    TEXT NOT NULL,
     room       TEXT NOT NULL DEFAULT '',
     teacher    TEXT NOT NULL DEFAULT '',
     start_time TEXT NOT NULL DEFAULT '',
     end_time   TEXT NOT NULL DEFAULT '',
     color      TEXT NOT NULL DEFAULT '#7e8894'
   )`,

  // В одну ячейку сетки (день × пара) помещается ровно один предмет.
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_cell
     ON schedule_slots(weekday, pair_index)`,

  `CREATE TABLE IF NOT EXISTS notes (
     id         TEXT PRIMARY KEY,
     title      TEXT NOT NULL DEFAULT '',
     body       TEXT NOT NULL DEFAULT '',
     date       TEXT NOT NULL,
     subject    TEXT NOT NULL DEFAULT '',
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   )`,

  `CREATE INDEX IF NOT EXISTS idx_notes_date ON notes(date DESC)`,

  `CREATE TABLE IF NOT EXISTS tasks (
     id           TEXT PRIMARY KEY,
     title        TEXT NOT NULL,
     description  TEXT NOT NULL DEFAULT '',
     due_date     TEXT NOT NULL DEFAULT '',
     done         INTEGER NOT NULL DEFAULT 0,
     urgent       INTEGER NOT NULL DEFAULT 0,
     important    INTEGER NOT NULL DEFAULT 1,
     subject      TEXT NOT NULL DEFAULT '',
     created_at   TEXT NOT NULL,
     completed_at TEXT
   )`,

  `CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done, due_date)`,

  // ─── Доходы ─────────────────────────────────────────────────────────────────
  // Отдельная таблица, а не траты с плюсом: у дохода другой смысл и другие
  // вопросы к нему. Смешав их в одной таблице, пришлось бы фильтровать по
  // знаку в каждом запросе и следить, чтобы доход не попал в разбивку
  // по категориям.
  `CREATE TABLE IF NOT EXISTS incomes (
     id         TEXT PRIMARY KEY,
     date       TEXT NOT NULL,
     amount     REAL NOT NULL,
     source     TEXT NOT NULL DEFAULT '',
     created_at TEXT NOT NULL
   )`,

  `CREATE INDEX IF NOT EXISTS idx_incomes_date ON incomes(date DESC)`,

  // ─── Настройки ──────────────────────────────────────────────────────────────
  // Ключ-значение для того, что не заслуживает своей таблицы: токен
  // календарной ленты, флаги, будущие настройки уведомлений.
  `CREATE TABLE IF NOT EXISTS settings (
     key   TEXT PRIMARY KEY,
     value TEXT NOT NULL
   )`,
];

/**
 * Добавление колонок к существующим таблицам.
 * SQLite не умеет `ADD COLUMN IF NOT EXISTS`, поэтому ошибки дублирования
 * игнорируются вызывающей стороной (scripts/migrate.ts).
 */
export const ALTER_STATEMENTS: string[] = [
  // Отпечаток строки банковской выписки: дата + сумма + описание.
  // Пустой у трат, заведённых руками.
  `ALTER TABLE expenses ADD COLUMN import_key TEXT NOT NULL DEFAULT ''`,
];

/**
 * Индексы, которым нужны колонки из ALTER_STATEMENTS.
 *
 * Выполняются миграцией строго после ALTER — в ленивой инициализации их нет
 * намеренно: на базе, где колонку ещё не добавили, такой индекс уронил бы весь
 * батч, а вместе с ним и запуск приложения. Защита от повторного импорта
 * поэтому не полагается на индекс: действие импорта само сверяется с уже
 * записанными ключами, а индекс остаётся страховкой на уровне базы.
 */
export const POST_ALTER_STATEMENTS: string[] = [
  // Частичный индекс: уникальность нужна только импортированным строкам.
  // Без WHERE все записи, заведённые руками, имели бы одинаковый пустой ключ
  // и конфликтовали бы между собой.
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_import_key
     ON expenses(import_key) WHERE import_key <> ''`,
];

/** Базовые категории расходов. Пользователь может добавлять свои. */
export const DEFAULT_CATEGORIES: ReadonlyArray<{
  id: string;
  name: string;
  color: string;
  icon: string;
  sortOrder: number;
}> = [
  { id: "cat_groceries", name: "Магазин", color: "#e0642f", icon: "shopping-cart", sortOrder: 10 },
  { id: "cat_food", name: "Еда", color: "#c4457c", icon: "utensils", sortOrder: 20 },
  { id: "cat_transport", name: "Транспорт", color: "#2f80ed", icon: "bus", sortOrder: 30 },
  { id: "cat_study", name: "Учёба", color: "#12a594", icon: "graduation-cap", sortOrder: 40 },
  { id: "cat_fun", name: "Развлечения", color: "#7a5af8", icon: "gamepad-2", sortOrder: 50 },
  { id: "cat_other", name: "Другое", color: "#7e8894", icon: "tag", sortOrder: 60 },
];

/**
 * Идемпотентная вставка базовых категорий.
 * `INSERT OR IGNORE` не трогает записи, которые пользователь уже переименовал.
 */
export const SEED_STATEMENTS: string[] = DEFAULT_CATEGORIES.map(
  (category) =>
    `INSERT OR IGNORE INTO categories (id, name, color, icon, is_default, sort_order)
     VALUES ('${category.id}', '${category.name}', '${category.color}', '${category.icon}', 1, ${category.sortOrder})`,
);
