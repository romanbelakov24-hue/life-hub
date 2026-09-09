/**
 * Демо-данные для проверки интерфейса: `npm run db:seed -- --yes`.
 *
 * Заполняет базу правдоподобными тратами за два месяца, делами в календаре,
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

const SAMPLE_EVENTS = [
  { title: "Доктор", location: "Клиника на Ленинском", start: "17:00", end: "18:00", offset: -7 },
  { title: "Доктор", location: "Клиника на Ленинском", start: "17:00", end: "18:00", offset: 0 },
  { title: "Доктор", location: "Клиника на Ленинском", start: "17:00", end: "18:00", offset: 7 },
  { title: "Тренировка", location: "Фитнес-клуб", start: "20:00", end: "21:30", offset: -5 },
  { title: "Тренировка", location: "Фитнес-клуб", start: "20:00", end: "21:30", offset: 2 },
  { title: "Тренировка", location: "Фитнес-клуб", start: "20:00", end: "21:30", offset: 9 },
  { title: "День рождения у Насти", location: "", start: "", end: "", offset: 4 },
  { title: "Встреча со старостой", location: "", start: "16:00", end: "16:30", offset: 1 },
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

const SAMPLE_GOALS: Array<{
  name: string;
  color: string;
  icon: string;
  targetAmount: number;
  /** Как offset у SAMPLE_EVENTS: отрицательное — уже прошло, положительное — в будущем; null — без срока. */
  targetDateOffset: number | null;
  contributions: Array<{ amount: number; daysAgo: number; note: string }>;
}> = [
  {
    name: "Новый ноутбук",
    color: "#e0642f",
    icon: "smartphone",
    targetAmount: 65_000,
    targetDateOffset: 75,
    contributions: [
      { amount: 5000, daysAgo: 45, note: "Стипендия" },
      { amount: 8000, daysAgo: 30, note: "Подработка" },
      { amount: 10_000, daysAgo: 10, note: "Родители помогли" },
    ],
  },
  {
    name: "Поездка в Питер",
    color: "#2f80ed",
    icon: "plane",
    targetAmount: 25_000,
    targetDateOffset: 18,
    contributions: [
      { amount: 10_000, daysAgo: 25, note: "Со стипендии" },
      { amount: 6000, daysAgo: 12, note: "Подработка" },
      { amount: 5000, daysAgo: 3, note: "Сэкономил на еде" },
    ],
  },
  {
    name: "Подарок на день рождения",
    color: "#c4457c",
    icon: "gift",
    targetAmount: 6000,
    targetDateOffset: -2, // срок уже прошёл — демонстрирует просроченную цель
    contributions: [
      { amount: 2000, daysAgo: 15, note: "Отложил заранее" },
      { amount: 1000, daysAgo: 5, note: "" },
    ],
  },
  {
    name: "Новые кроссовки",
    color: "#4f9d2f",
    icon: "dumbbell",
    targetAmount: 9000,
    targetDateOffset: null,
    contributions: [{ amount: 9500, daysAgo: 20, note: "Скопил за месяц" }], // с запасом — цель достигнута
  },
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

  // ─── Календарь ──────────────────────────────────────────────────────────────
  const paletteByIndex = ["#e0642f", "#c4457c", "#7a5af8", "#2f80ed", "#12a594", "#4f9d2f"];
  const titleColors = new Map<string, string>();

  await client.batch(
    SAMPLE_EVENTS.map((event) => {
      if (!titleColors.has(event.title)) {
        titleColors.set(
          event.title,
          paletteByIndex[titleColors.size % paletteByIndex.length] ?? "#7e8894",
        );
      }

      return {
        sql: `INSERT INTO events
                (id, date, start_time, end_time, title, location, description, color, created_at)
              VALUES (?, ?, ?, ?, ?, ?, '', ?, ?)`,
        args: [
          randomId("evt"),
          daysAgo(-event.offset),
          event.start,
          event.end,
          event.title,
          event.location,
          titleColors.get(event.title) ?? "#7e8894",
          now,
        ],
      };
    }),
    "write",
  );
  console.log(`Дел в календаре: ${SAMPLE_EVENTS.length}.`);

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

  // ─── Цели накоплений ────────────────────────────────────────────────────────
  const goalIds = SAMPLE_GOALS.map(() => randomId("goal"));

  await client.batch(
    SAMPLE_GOALS.map((goal, index) => ({
      sql: `INSERT INTO savings_goals (id, name, color, icon, target_amount, target_date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        goalIds[index] ?? randomId("goal"),
        goal.name,
        goal.color,
        goal.icon,
        goal.targetAmount,
        goal.targetDateOffset === null ? null : daysAgo(-goal.targetDateOffset),
        now,
      ],
    })),
    "write",
  );

  const contributionStatements = SAMPLE_GOALS.flatMap((goal, index) =>
    goal.contributions.map((contribution) => ({
      sql: `INSERT INTO savings_contributions (id, goal_id, date, amount, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        randomId("contrib"),
        goalIds[index] ?? "",
        daysAgo(contribution.daysAgo),
        contribution.amount,
        contribution.note,
        now,
      ],
    })),
  );
  await client.batch(contributionStatements, "write");
  console.log(`Целей накоплений: ${SAMPLE_GOALS.length}, пополнений: ${contributionStatements.length}.`);

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
