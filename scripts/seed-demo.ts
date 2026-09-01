/**
 * Демо-данные для проверки интерфейса: `npm run db:seed -- --yes`.
 *
 * Заполняет базу правдоподобными тратами за два месяца, расписанием,
 * задачами и заметками. Нужен, чтобы посмотреть, как выглядят графики и
 * списки с реальными объёмами данных, не вводя всё руками.
 *
 * Флаг --yes обязателен: скрипт пишет в ту же базу, что и приложение,
 * и случайный запуск на боевой Turso добавил бы туда мусор.
 */

import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DEFAULT_CATEGORIES, SCHEMA_STATEMENTS, SEED_STATEMENTS } from "../src/lib/db/schema";

function loadEnvFile(fileName: string): void {
  try {
    const content = readFileSync(resolve(process.cwd(), fileName), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Файла нет — используем переменные окружения как есть.
  }
}

/** Локальный аналог toIso из lib/utils/date (скрипт не тянет alias-пути). */
function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toIso(date);
}

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2, 14)}`;
}

const SAMPLE_PURCHASES: Array<{ categoryId: string; note: string; min: number; max: number }> = [
  { categoryId: "cat_groceries", note: "Продукты", min: 450, max: 2400 },
  { categoryId: "cat_groceries", note: "Пятёрочка", min: 300, max: 1500 },
  { categoryId: "cat_food", note: "Кофе", min: 150, max: 400 },
  { categoryId: "cat_food", note: "Обед в столовой", min: 250, max: 600 },
  { categoryId: "cat_food", note: "Шаурма", min: 220, max: 380 },
  { categoryId: "cat_transport", note: "Проезд", min: 60, max: 160 },
  { categoryId: "cat_transport", note: "Такси", min: 300, max: 900 },
  { categoryId: "cat_study", note: "Печать методички", min: 80, max: 350 },
  { categoryId: "cat_study", note: "Тетради и ручки", min: 200, max: 700 },
  { categoryId: "cat_fun", note: "Кино", min: 400, max: 900 },
  { categoryId: "cat_fun", note: "Подписка", min: 199, max: 699 },
  { categoryId: "cat_other", note: "Аптека", min: 250, max: 1200 },
];

const SAMPLE_SCHEDULE = [
  { weekday: 1, pairIndex: 1, subject: "Матанализ", room: "412", teacher: "Орлова А. В." },
  { weekday: 1, pairIndex: 2, subject: "Линейная алгебра", room: "412", teacher: "Орлова А. В." },
  { weekday: 1, pairIndex: 4, subject: "Английский", room: "207", teacher: "Крылова М. С." },
  { weekday: 2, pairIndex: 2, subject: "Программирование", room: "305", teacher: "Демин П. Р." },
  { weekday: 2, pairIndex: 3, subject: "Программирование", room: "305", teacher: "Демин П. Р." },
  { weekday: 3, pairIndex: 1, subject: "Физика", room: "118", teacher: "Соколов И. И." },
  { weekday: 3, pairIndex: 3, subject: "История", room: "220", teacher: "Фомина Л. Д." },
  { weekday: 4, pairIndex: 2, subject: "Матанализ", room: "412", teacher: "Орлова А. В." },
  { weekday: 4, pairIndex: 3, subject: "Базы данных", room: "310", teacher: "Демин П. Р." },
  { weekday: 5, pairIndex: 1, subject: "Физика", room: "118", teacher: "Соколов И. И." },
  { weekday: 5, pairIndex: 2, subject: "Английский", room: "207", teacher: "Крылова М. С." },
];

const SAMPLE_TASKS = [
  { title: "Сдать лабораторную по физике", subject: "Физика", due: daysAgo(1), urgent: 1, important: 1 },
  { title: "Дорешать задачи по матанализу", subject: "Матанализ", due: daysAgo(-1), urgent: 1, important: 1 },
  { title: "Подготовиться к контрольной по алгебре", subject: "Линейная алгебра", due: daysAgo(-4), urgent: 0, important: 1 },
  { title: "Написать реферат по истории", subject: "История", due: daysAgo(-10), urgent: 0, important: 1 },
  { title: "Ответить старосте про пересдачу", subject: "", due: daysAgo(0), urgent: 1, important: 0 },
  { title: "Разобрать почту и рассылки", subject: "", due: "", urgent: 0, important: 0 },
  { title: "Сделать макет проекта по БД", subject: "Базы данных", due: daysAgo(-6), urgent: 0, important: 1 },
];

const SAMPLE_NOTES = [
  {
    title: "Формула Тейлора",
    body: "f(x) = Σ fⁿ(a)/n! · (x−a)ⁿ\nОстаточный член в форме Лагранжа разбирали на паре 12-го.",
    subject: "Матанализ",
    date: daysAgo(6),
  },
  {
    title: "Нормальные формы БД",
    body: "1НФ — атомарность значений\n2НФ — нет частичных зависимостей\n3НФ — нет транзитивных зависимостей",
    subject: "Базы данных",
    date: daysAgo(3),
  },
  {
    title: "К контрольной по физике",
    body: "Разобрать: законы Кирхгофа, RC-цепи, задачи 4.12–4.20 из сборника.",
    subject: "Физика",
    date: daysAgo(1),
  },
  {
    title: "Слова к зачёту",
    body: "deadline, assignment, curriculum, tuition, scholarship",
    subject: "Английский",
    date: daysAgo(8),
  },
];

async function main(): Promise<void> {
  if (!process.argv.includes("--yes")) {
    console.error(
      "Скрипт добавит демо-данные в базу приложения.\n" +
        "Если это то, что нужно, запустите: npm run db:seed -- --yes",
    );
    process.exit(1);
  }

  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const url = process.env.TURSO_DATABASE_URL;
  const client = url
    ? createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })
    : createClient({ url: "file:local.db" });

  await client.batch(SCHEMA_STATEMENTS, "write");
  await client.batch(SEED_STATEMENTS, "write");

  // ─── Траты за последние 60 дней ─────────────────────────────────────────────
  const expenseStatements: Array<{ sql: string; args: (string | number)[] }> = [];
  const now = new Date().toISOString();

  for (let dayOffset = 0; dayOffset < 60; dayOffset += 1) {
    // 0–3 траты в день: получается неровный график, как в жизни.
    const purchasesToday = Math.floor(Math.random() * 4);

    for (let index = 0; index < purchasesToday; index += 1) {
      const sample = SAMPLE_PURCHASES[Math.floor(Math.random() * SAMPLE_PURCHASES.length)];
      if (!sample) continue;

      const amount = Math.round(sample.min + Math.random() * (sample.max - sample.min));

      expenseStatements.push({
        sql: `INSERT INTO expenses (id, date, category_id, note, amount, created_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [randomId("exp"), daysAgo(dayOffset), sample.categoryId, sample.note, amount, now],
      });
    }
  }

  await client.batch(expenseStatements, "write");
  console.log(`Добавлено трат: ${expenseStatements.length}.`);

  // ─── Расписание ─────────────────────────────────────────────────────────────
  const paletteByIndex = ["#e0642f", "#c4457c", "#7a5af8", "#2f80ed", "#12a594", "#4f9d2f"];
  const subjectColors = new Map<string, string>();

  await client.batch(
    SAMPLE_SCHEDULE.map((slot) => {
      if (!subjectColors.has(slot.subject)) {
        subjectColors.set(
          slot.subject,
          paletteByIndex[subjectColors.size % paletteByIndex.length] ?? "#7e8894",
        );
      }

      return {
        sql: `INSERT INTO schedule_slots
                (id, weekday, pair_index, subject, room, teacher, start_time, end_time, color)
              VALUES (?, ?, ?, ?, ?, ?, '', '', ?)
              ON CONFLICT(weekday, pair_index) DO UPDATE SET subject = excluded.subject`,
        args: [
          randomId("slot"),
          slot.weekday,
          slot.pairIndex,
          slot.subject,
          slot.room,
          slot.teacher,
          subjectColors.get(slot.subject) ?? "#7e8894",
        ],
      };
    }),
    "write",
  );
  console.log(`Пар в расписании: ${SAMPLE_SCHEDULE.length}.`);

  // ─── Задачи ─────────────────────────────────────────────────────────────────
  await client.batch(
    SAMPLE_TASKS.map((task) => ({
      sql: `INSERT INTO tasks
              (id, title, description, due_date, done, urgent, important, subject, created_at, completed_at)
            VALUES (?, ?, '', ?, 0, ?, ?, ?, ?, NULL)`,
      args: [randomId("task"), task.title, task.due, task.urgent, task.important, task.subject, now],
    })),
    "write",
  );
  console.log(`Задач: ${SAMPLE_TASKS.length}.`);

  // ─── Заметки ────────────────────────────────────────────────────────────────
  await client.batch(
    SAMPLE_NOTES.map((note) => ({
      sql: `INSERT INTO notes (id, title, body, date, subject, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [randomId("note"), note.title, note.body, note.date, note.subject, now, now],
    })),
    "write",
  );
  console.log(`Заметок: ${SAMPLE_NOTES.length}.`);

  console.log(`Готово. Категорий в базе: ${DEFAULT_CATEGORIES.length}+.`);
}

main().catch((error) => {
  console.error("Не удалось заполнить демо-данные:", error);
  process.exit(1);
});
