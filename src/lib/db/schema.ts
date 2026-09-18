/**
 * Схема базы — список версионных миграций и стартовые данные.
 *
 * Правила эволюции схемы:
 *  • Любое изменение — новая миграция В КОНЕЦ списка со следующим номером.
 *    Уже выпущенные миграции не правятся никогда: на проде они выполнены, и
 *    правка разошлась бы с тем, что там лежит на самом деле.
 *  • Каждая миграция выполняется ровно один раз, целиком в одной транзакции
 *    вместе с записью своего номера в schema_migrations (см. migrator.ts).
 *    Упала посередине — откатилась целиком, номер не записан.
 *  • Миграция должна быть совместима с кодом, который сейчас на проде:
 *    `npm run cf:deploy` сначала требует применённых миграций, и между
 *    миграцией и деплоем старый код работает уже на новой схеме. Поэтому
 *    колонки добавляются (с DEFAULT), а удаляются отдельной миграцией после
 *    деплоя кода, который их больше не читает.
 *  • Пересборка таблицы (SQLite не умеет менять ограничения через ALTER)
 *    допустима, но только внутри миграции: она выполнится один раз, а не на
 *    каждом прогоне, как было до версий.
 *
 * Как база жила до версий — legacy-schema.ts.
 */

export interface Migration {
  /** Порядковый номер, начиная с 1. Пропусков и повторов нет — это проверяет тест. */
  version: number;
  /** Короткое имя для журнала миграций. */
  name: string;
  up: string[];
}

export const MIGRATIONS: Migration[] = [
  {
    // Итоговая схема «доверсионной» эпохи — ровно та, до которой прод довёл
    // конвейер из legacy-schema.ts. Совпадение колонок, ключей и индексов
    // проверяет migrator.test.ts. Порядок колонок тоже сохранён: user_id у
    // старых таблиц стоит в конце, потому что добавлялся через ALTER.
    version: 1,
    name: "init",
    up: [
      `CREATE TABLE users (
         id            TEXT PRIMARY KEY,
         email         TEXT NOT NULL UNIQUE,
         password_hash TEXT NOT NULL,
         name          TEXT NOT NULL DEFAULT '',
         created_at    TEXT NOT NULL
       )`,

      // Сессия — случайный токен в cookie и строка здесь. Выход — удалить строку.
      `CREATE TABLE sessions (
         token      TEXT PRIMARY KEY,
         user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         created_at TEXT NOT NULL,
         expires_at TEXT NOT NULL
       )`,
      `CREATE INDEX idx_sessions_user ON sessions(user_id)`,

      // user_id нулевой у всех «старых» таблиц: строки без владельца забирает
      // первый зарегистрированный (claimLegacyData в queries/users.ts).
      `CREATE TABLE categories (
         id            TEXT PRIMARY KEY,
         user_id       TEXT,
         name          TEXT NOT NULL,
         color         TEXT NOT NULL DEFAULT '#7e8894',
         icon          TEXT NOT NULL DEFAULT 'tag',
         is_default    INTEGER NOT NULL DEFAULT 0,
         sort_order    INTEGER NOT NULL DEFAULT 100,
         monthly_limit REAL
       )`,
      `CREATE UNIQUE INDEX idx_categories_user_name ON categories(user_id, name)`,

      // import_key — отпечаток строки банковской выписки (дата + сумма +
      // описание), пустой у трат, заведённых руками. По нему отсекаются
      // повторные импорты — уникален в пределах пользователя.
      `CREATE TABLE expenses (
         id          TEXT PRIMARY KEY,
         date        TEXT NOT NULL,
         category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
         note        TEXT NOT NULL DEFAULT '',
         amount      REAL NOT NULL,
         created_at  TEXT NOT NULL,
         import_key  TEXT NOT NULL DEFAULT '',
         user_id     TEXT
       )`,
      `CREATE INDEX idx_expenses_date ON expenses(date DESC)`,
      `CREATE INDEX idx_expenses_category ON expenses(category_id)`,
      `CREATE INDEX idx_expenses_user_date ON expenses(user_id, date DESC)`,
      `CREATE UNIQUE INDEX idx_expenses_import_key
         ON expenses(user_id, import_key) WHERE import_key <> ''`,

      // Доход — отдельная таблица, а не траты с плюсом: иначе пришлось бы
      // фильтровать по знаку в каждом запросе.
      `CREATE TABLE incomes (
         id         TEXT PRIMARY KEY,
         date       TEXT NOT NULL,
         amount     REAL NOT NULL,
         source     TEXT NOT NULL DEFAULT '',
         created_at TEXT NOT NULL,
         user_id    TEXT
       )`,
      `CREATE INDEX idx_incomes_date ON incomes(date DESC)`,
      `CREATE INDEX idx_incomes_user_date ON incomes(user_id, date DESC)`,

      // Копилки: цель и лента пополнений. Удаление цели уносит её пополнения.
      `CREATE TABLE savings_goals (
         id            TEXT PRIMARY KEY,
         user_id       TEXT,
         name          TEXT NOT NULL,
         color         TEXT NOT NULL DEFAULT '#7e8894',
         icon          TEXT NOT NULL DEFAULT 'tag',
         target_amount REAL NOT NULL,
         target_date   TEXT,
         created_at    TEXT NOT NULL
       )`,
      `CREATE INDEX idx_savings_goals_user ON savings_goals(user_id)`,
      `CREATE TABLE savings_contributions (
         id         TEXT PRIMARY KEY,
         user_id    TEXT,
         goal_id    TEXT NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
         date       TEXT NOT NULL,
         amount     REAL NOT NULL,
         note       TEXT NOT NULL DEFAULT '',
         created_at TEXT NOT NULL
       )`,
      `CREATE INDEX idx_savings_contributions_goal ON savings_contributions(goal_id)`,
      `CREATE INDEX idx_savings_contributions_user ON savings_contributions(user_id)`,

      // Календарь дел на конкретные даты. «Повторить по неделям» — это
      // несколько строк, хранимого правила повторения нет.
      `CREATE TABLE events (
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
      `CREATE INDEX idx_events_user_date ON events(user_id, date)`,

      `CREATE TABLE notes (
         id         TEXT PRIMARY KEY,
         title      TEXT NOT NULL DEFAULT '',
         body       TEXT NOT NULL DEFAULT '',
         date       TEXT NOT NULL,
         subject    TEXT NOT NULL DEFAULT '',
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL,
         user_id    TEXT
       )`,
      `CREATE INDEX idx_notes_date ON notes(date DESC)`,
      `CREATE INDEX idx_notes_user_date ON notes(user_id, date DESC)`,

      `CREATE TABLE tasks (
         id           TEXT PRIMARY KEY,
         title        TEXT NOT NULL,
         description  TEXT NOT NULL DEFAULT '',
         due_date     TEXT NOT NULL DEFAULT '',
         done         INTEGER NOT NULL DEFAULT 0,
         urgent       INTEGER NOT NULL DEFAULT 0,
         important    INTEGER NOT NULL DEFAULT 1,
         subject      TEXT NOT NULL DEFAULT '',
         created_at   TEXT NOT NULL,
         completed_at TEXT,
         user_id      TEXT
       )`,
      `CREATE INDEX idx_tasks_done ON tasks(done, due_date)`,
      `CREATE INDEX idx_tasks_user_done ON tasks(user_id, done, due_date)`,

      // Одна строка на день, метрики заполняются по мере поступления от
      // автоматизаций «Быстрых команд» (апсерт по дате).
      `CREATE TABLE health_daily (
         user_id             TEXT,
         date                TEXT NOT NULL,
         steps               INTEGER,
         sleep_minutes       INTEGER,
         resting_heart_rate  INTEGER,
         screen_time_minutes INTEGER,
         updated_at          TEXT NOT NULL,
         PRIMARY KEY (user_id, date)
       )`,

      // Ключ-значение для того, что не заслуживает отдельной таблицы: токены
      // ленты календаря, сводки, вебхука здоровья, агента.
      `CREATE TABLE settings (
         user_id TEXT,
         key     TEXT NOT NULL,
         value   TEXT NOT NULL,
         PRIMARY KEY (user_id, key)
       )`,
    ],
  },
];

/** Номер последней миграции — до него должна быть доведена база. */
export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;

/**
 * Базовые категории расходов — стартовый набор каждого нового пользователя
 * (seedCategoriesForUser в queries/expenses.ts, со свежими id). Фиксированные
 * id здесь — наследие одного пользователя без аккаунта, их использует только
 * legacy-schema.ts и демо-данные.
 */
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
