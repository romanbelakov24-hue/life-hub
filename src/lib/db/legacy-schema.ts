/**
 * Схема базы в том виде, как она жила до версионных миграций (до 18.09.2026).
 *
 * Здесь больше ничего не меняется. Модуль нужен в двух местах:
 *  • migrator.ts — один раз довести «доверсионную» базу (прод) до итоговой
 *    формы и пометить её версией 1; дальше она живёт только по MIGRATIONS;
 *  • migrator.test.ts — доказать, что версия 1 из schema.ts создаёт ровно ту же
 *    схему, что и этот конвейер, иначе прод и новая база разошлись бы.
 *
 * Конвейер из трёх шагов: SCHEMA (CREATE IF NOT EXISTS) → ALTER (ошибка
 * «duplicate column name» гасится) → POST_ALTER (пересборка таблиц с полным
 * копированием, через client.migrate с отключёнными внешними ключами) → SEED.
 * Каждый шаг идемпотентен, поэтому базу, прошедшую его частично, он тоже
 * доводит до конца.
 *
 * Когда прод переведён на версии, файл можно удалить вместе с веткой
 * «доверсионная база» в migrator.ts.
 */

import { DEFAULT_CATEGORIES } from "./schema";

export const LEGACY_SCHEMA_STATEMENTS: string[] = [
  // ─── Пользователи ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS users (
     id            TEXT PRIMARY KEY,
     email         TEXT NOT NULL UNIQUE,
     password_hash TEXT NOT NULL,
     name          TEXT NOT NULL DEFAULT '',
     created_at    TEXT NOT NULL
   )`,

  // Сессия — просто случайный токен в cookie, строка в этой таблице.
  // Удалить сессию (logout, компрометация) — значит удалить строку: не нужно
  // ни JWT, ни секрета для подписи, отзыв работает сразу.
  `CREATE TABLE IF NOT EXISTS sessions (
     token      TEXT PRIMARY KEY,
     user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at TEXT NOT NULL,
     expires_at TEXT NOT NULL
   )`,

  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,

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
  // Календарь дел на конкретные даты — не еженедельная сетка. Пары самого
  // ВШЭ синхронизируются владельцем напрямую из ЛК в Apple/Google Календарь;
  // это место для всего остального (разовые встречи, кружки, тренировки).
  // «Повторить по неделям» на форме создания — это просто несколько отдельных
  // строк с разными датами, без хранимого правила повторения: см.
  // actions/events.ts. Старая понедельная сетка (schedule_slots) удалена
  // POST_ALTER_STATEMENTS ниже вместе с переходом на эту таблицу.
  `CREATE TABLE IF NOT EXISTS events (
     id          TEXT PRIMARY KEY,
     user_id     TEXT,
     date        TEXT NOT NULL,
     start_time  TEXT NOT NULL DEFAULT '',
     end_time    TEXT NOT NULL DEFAULT '',
     title       TEXT NOT NULL,
     location    TEXT NOT NULL DEFAULT '',
     description TEXT NOT NULL DEFAULT '',
     color       TEXT NOT NULL DEFAULT '#7e8894',
     created_at  TEXT NOT NULL
   )`,

  `CREATE INDEX IF NOT EXISTS idx_events_user_date ON events(user_id, date)`,

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

  // ─── Цели накоплений ────────────────────────────────────────────────────────
  // Отдельная от доходов/трат «копилка»: сумма цели, необязательный срок,
  // и лента пополнений (savings_contributions) — сколько и когда отложили.
  // Прогресс не завязан на бюджет месяца: отложенное для цели не вычитается
  // из «сколько можно тратить в день» — это самостоятельный трекер, а не
  // ещё один слой над BudgetForecast. Таблица новая, второго этапа миграции
  // не требует: user_id нулевой сразу здесь, как и у events (см. комментарий
  // там) — ради того же демо-сидинга без владельца.
  `CREATE TABLE IF NOT EXISTS savings_goals (
     id            TEXT PRIMARY KEY,
     user_id       TEXT,
     name          TEXT NOT NULL,
     color         TEXT NOT NULL DEFAULT '#7e8894',
     icon          TEXT NOT NULL DEFAULT 'tag',
     target_amount REAL NOT NULL,
     target_date   TEXT,
     created_at    TEXT NOT NULL
   )`,

  `CREATE INDEX IF NOT EXISTS idx_savings_goals_user ON savings_goals(user_id)`,

  // Пополнения копилки — только положительные суммы (как у incomes): ошибочную
  // запись правят удалением, а не минусом. Каскадное удаление — чтобы удаление
  // цели не оставляло висящих пополнений без хозяина.
  `CREATE TABLE IF NOT EXISTS savings_contributions (
     id         TEXT PRIMARY KEY,
     user_id    TEXT,
     goal_id    TEXT NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
     date       TEXT NOT NULL,
     amount     REAL NOT NULL,
     note       TEXT NOT NULL DEFAULT '',
     created_at TEXT NOT NULL
   )`,

  `CREATE INDEX IF NOT EXISTS idx_savings_contributions_goal ON savings_contributions(goal_id)`,
  `CREATE INDEX IF NOT EXISTS idx_savings_contributions_user ON savings_contributions(user_id)`,

  // ─── Здоровье ───────────────────────────────────────────────────────────────
  // Одна строка на день, поля заполняются по мере поступления. У Apple Health
  // и Xiaomi Health нет веб-API — данные приходят POST-запросом от автоматизации
  // «Быстрых команд» на iPhone (см. HEALTH_TOKEN_KEY в settings и API-роут
  // /api/health/[token]). Апсерт по дате: разные автоматизации могут слать
  // разные метрики в разное время суток, каждая заполняет только свои поля.
  // До многопользовательского режима PRIMARY KEY — просто date; после
  // POST_ALTER_STATEMENTS таблица пересобирается под (user_id, date).
  `CREATE TABLE IF NOT EXISTS health_daily (
     date               TEXT PRIMARY KEY,
     steps              INTEGER,
     sleep_minutes      INTEGER,
     resting_heart_rate INTEGER,
     updated_at         TEXT NOT NULL
   )`,

  // ─── Настройки ──────────────────────────────────────────────────────────────
  // Ключ-значение для того, что не заслуживает отдельной таблицы: токены
  // календарной ленты / сводки / вебхука здоровья, флаги. До многопользовательского
  // режима PRIMARY KEY — просто key (одна запись на приложение); после
  // POST_ALTER_STATEMENTS — (user_id, key), у каждого пользователя свои токены.
  `CREATE TABLE IF NOT EXISTS settings (
     key   TEXT PRIMARY KEY,
     value TEXT NOT NULL
   )`,
];

/**
 * Добавление колонок к существующим таблицам.
 * SQLite не умеет `ADD COLUMN IF NOT EXISTS`, поэтому ошибки дублирования
 * игнорируются вызывающей стороной (scripts/migrate.ts).
 *
 * user_id везде нулевой (без NOT NULL и без значения по умолчанию) намеренно:
 * это то немногое в схеме, что не самодостаточно — на существующих строках он
 * пуст, пока владелец не «заберёт» их при первой регистрации (см. claimLegacyData
 * в lib/auth/user.ts). Дальше каждая запись всегда пишется и читается только
 * приложением, с явным user_id — по тому же принципу, что и import_key раньше:
 * инвариант держит код, а не ограничение базы.
 */
export const LEGACY_ALTER_STATEMENTS: string[] = [
  // Отпечаток строки банковской выписки: дата + сумма + описание.
  // Пустой у трат, заведённых руками.
  `ALTER TABLE expenses ADD COLUMN import_key TEXT NOT NULL DEFAULT ''`,

  `ALTER TABLE expenses ADD COLUMN user_id TEXT`,
  `ALTER TABLE categories ADD COLUMN user_id TEXT`,
  `ALTER TABLE notes ADD COLUMN user_id TEXT`,
  `ALTER TABLE tasks ADD COLUMN user_id TEXT`,
  `ALTER TABLE incomes ADD COLUMN user_id TEXT`,
  `ALTER TABLE health_daily ADD COLUMN user_id TEXT`,
  `ALTER TABLE settings ADD COLUMN user_id TEXT`,

  // Лимит трат в месяц на категорию. NULL — лимит не задан, категория не
  // участвует в блоке «Бюджеты по категориям» на странице расходов.
  `ALTER TABLE categories ADD COLUMN monthly_limit REAL`,

  // Экранное время в минутах за день. В отличие от шагов/сна/пульса это поле
  // не приходит из автоматизации «Быстрых команд»: у Apple нет действия
  // Shortcuts, которое читало бы Экранное время (в отличие от Здоровья, это
  // отдельный API с ограниченным доступом) — обещать автоматический сбор
  // здесь значило бы соврать. Записывается вручную на странице /health;
  // вебхук тоже принимает поле — на случай, если владелец найдёт свой способ
  // прислать его автоматически.
  `ALTER TABLE health_daily ADD COLUMN screen_time_minutes INTEGER`,
];

/**
 * Второй этап миграции — выполняется строго после ALTER_STATEMENTS.
 *
 * ⚠️ Ломает старый код: меняет уникальные ограничения, на которые опираются
 * его ON CONFLICT/UPSERT (schedule_slots, settings) и пересобирает settings и
 * health_daily под составной первичный ключ. Прогонять на проде можно только
 * вместе с деплоем нового кода — подробности в scripts/migrate.ts.
 */
export const LEGACY_POST_ALTER_STATEMENTS: string[] = [
  // Частичный индекс: уникальность нужна только импортированным строкам, и
  // теперь — в пределах одного пользователя, а не глобально.
  `DROP INDEX IF EXISTS idx_expenses_import_key`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_import_key
     ON expenses(user_id, import_key) WHERE import_key <> ''`,

  `CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_notes_user_date ON notes(user_id, date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_user_done ON tasks(user_id, done, due_date)`,
  `CREATE INDEX IF NOT EXISTS idx_incomes_user_date ON incomes(user_id, date DESC)`,

  // Понедельная сетка пар уступила место календарю на реальных датах (таблица
  // events выше) — старые данные раздела, по решению владельца, не переносятся.
  `DROP TABLE IF EXISTS schedule_slots`,

  // categories.name UNIQUE была глобальной ("Еда" — на всё приложение, не на
  // пользователя) — двум пользователям было бы физически невозможно завести
  // категорию с одинаковым названием, а стартовый набор категорий у каждого
  // называется одинаково. Колоночный UNIQUE через ALTER не убрать —
  // пересобираем таблицу без него и добавляем составной индекс.
  // monthly_limit перечислен и здесь: эта пересборка выполняется целиком при
  // каждом прогоне миграции (см. комментарий в начале файла), а не только один
  // раз — если забыть новую колонку тут, она молча потеряется при следующем
  // прогоне, даже если ALTER_STATEMENTS выше её честно добавил.
  `CREATE TABLE IF NOT EXISTS categories_v2 (
     id            TEXT PRIMARY KEY,
     user_id       TEXT,
     name          TEXT NOT NULL,
     color         TEXT NOT NULL DEFAULT '#7e8894',
     icon          TEXT NOT NULL DEFAULT 'tag',
     is_default    INTEGER NOT NULL DEFAULT 0,
     sort_order    INTEGER NOT NULL DEFAULT 100,
     monthly_limit REAL
   )`,
  `INSERT INTO categories_v2 (id, user_id, name, color, icon, is_default, sort_order, monthly_limit)
     SELECT id, user_id, name, color, icon, is_default, sort_order, monthly_limit FROM categories`,
  `DROP TABLE categories`,
  `ALTER TABLE categories_v2 RENAME TO categories`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_user_name ON categories(user_id, name)`,

  // settings: (key) -> (user_id, key). SQLite не умеет менять PRIMARY KEY
  // через ALTER — пересобираем таблицу: новая с нужным ключом, копия строк,
  // подмена имени. user_id уже добавлен ALTER_STATEMENTS выше (может быть
  // NULL — это «ничей» токен до первой регистрации, claimLegacyData разберёт).
  `CREATE TABLE IF NOT EXISTS settings_v2 (
     user_id TEXT,
     key     TEXT NOT NULL,
     value   TEXT NOT NULL,
     PRIMARY KEY (user_id, key)
   )`,
  `INSERT INTO settings_v2 (user_id, key, value)
     SELECT user_id, key, value FROM settings`,
  `DROP TABLE settings`,
  `ALTER TABLE settings_v2 RENAME TO settings`,

  // health_daily: (date) -> (user_id, date), тот же приём. screen_time_minutes
  // перечислен и здесь по той же причине, что monthly_limit у categories_v2
  // выше: эта пересборка выполняется целиком при каждом прогоне миграции, и
  // забытая тут новая колонка молча потеряется на следующем прогоне.
  `CREATE TABLE IF NOT EXISTS health_daily_v2 (
     user_id              TEXT,
     date                 TEXT NOT NULL,
     steps                INTEGER,
     sleep_minutes        INTEGER,
     resting_heart_rate   INTEGER,
     screen_time_minutes  INTEGER,
     updated_at           TEXT NOT NULL,
     PRIMARY KEY (user_id, date)
   )`,
  `INSERT INTO health_daily_v2
      (user_id, date, steps, sleep_minutes, resting_heart_rate, screen_time_minutes, updated_at)
     SELECT user_id, date, steps, sleep_minutes, resting_heart_rate, screen_time_minutes, updated_at
       FROM health_daily`,
  `DROP TABLE health_daily`,
  `ALTER TABLE health_daily_v2 RENAME TO health_daily`,
];

/** Базовые категории без владельца — их забирает первый зарегистрированный. */
export const LEGACY_SEED_STATEMENTS: string[] = DEFAULT_CATEGORIES.map(
  (category) =>
    `INSERT OR IGNORE INTO categories (id, name, color, icon, is_default, sort_order)
     VALUES ('${category.id}', '${category.name}', '${category.color}', '${category.icon}', 1, ${category.sortOrder})`,
);
