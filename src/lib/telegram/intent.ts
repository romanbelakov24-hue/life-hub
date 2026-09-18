import type { IsoDate } from "@/lib/types";
import { addDays, isValidIso, WEEKDAY_SHORT, weekdayOf } from "@/lib/utils/date";

import { addMinutesCapped, minutesOfDay, normalizeTime } from "./dates";

/**
 * Что бот понял из сообщения — и как ответ языковой модели превращается в
 * запись, которую пропустят валидаторы из lib/mutations.
 *
 * Модели не доверяем ни в чём: любое поле может прийти не того типа, дата —
 * в прошлом году, время — «25:00». normalizeIntent чинит, что можно, и
 * отбрасывает остальное, так что дальше идут только проверенные значения.
 */

export type IntentKind = "task" | "event" | "expense" | "note";

export type BotIntent =
  | {
      kind: "task";
      title: string;
      /** Срок; пусто — без срока. */
      dueDate: IsoDate | "";
      urgent: boolean;
      important: boolean;
      description: string;
    }
  | {
      kind: "event";
      title: string;
      date: IsoDate;
      /** Пусто вместе с endTime — дело на весь день. */
      startTime: string;
      endTime: string;
      location: string;
      description: string;
    }
  | {
      kind: "expense";
      amount: number;
      /** Название категории, как его понял разборщик; пусто — не понял. */
      category: string;
      note: string;
      date: IsoDate;
    }
  | { kind: "note"; title: string; body: string }
  | { kind: "unknown"; reply: string };

export interface IntentContext {
  today: IsoDate;
  /** Время у пользователя, «HH:MM». */
  now: string;
  timeZone: string;
  categories: string[];
  /** Команда /task, /event, /expense, /note задаёт тип явно. */
  forcedKind?: IntentKind;
  /** Исходный текст — запасное название, если модель его не вернула. */
  originalText: string;
}

// ─── Пределы — те же, что у валидаторов в lib/mutations ─────────────────────

const TASK_TITLE_MAX = 160;
const EVENT_TITLE_MAX = 120;
const NOTE_TITLE_MAX = 120;
const EXPENSE_NOTE_MAX = 200;
const DETAILS_MAX = 2000;
const PLACE_MAX = 120;

export const UNKNOWN_REPLY =
  "Я записываю задачи, дела в календарь, траты и заметки. Напиши, например, " +
  "«завтра в 15:00 созвон с Лизой», «сдать эссе до пятницы» или «кофе 250».";

// ─── Схема ответа модели ─────────────────────────────────────────────────────

export const INTENT_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["task", "event", "expense", "note", "unknown"] },
    title: { type: "string" },
    date: { type: "string" },
    start: { type: "string" },
    end: { type: "string" },
    amount: { type: "number" },
    category: { type: "string" },
    urgent: { type: "boolean" },
    important: { type: "boolean" },
    location: { type: "string" },
    details: { type: "string" },
    reply: { type: "string" },
  },
  // Обязательны ВСЕ поля: генерация под схему останавливается, как только
  // выданы обязательные, — с required: ["kind", "title"] модель не присылала ни
  // даты, ни времени, ни суммы. Пустые значения — "", 0 и false.
  required: [
    "kind",
    "title",
    "date",
    "start",
    "end",
    "amount",
    "category",
    "urgent",
    "important",
    "location",
    "details",
    "reply",
  ],
} as const;

const WEEKDAY_FULL_LOWER = ["", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];
const WEEKDAY_ACCUSATIVE = ["", "понедельник", "вторник", "среду", "четверг", "пятницу", "субботу", "воскресенье"];
const WEEKDAY_GENITIVE = ["", "понедельника", "вторника", "среды", "четверга", "пятницы", "субботы", "воскресенья"];

/**
 * Подсказка модели. Таблица ближайших дат снимает самую частую ошибку
 * небольших моделей — «в пятницу» с неверным числом: считать день недели им
 * не нужно, только найти строку.
 */
export function buildIntentMessages(text: string, context: IntentContext) {
  const days = Array.from({ length: 14 }, (_, offset) => {
    const date = addDays(context.today, offset);
    const label = offset === 0 ? " (сегодня)" : offset === 1 ? " (завтра)" : "";
    return `${WEEKDAY_SHORT[weekdayOf(date)].toLowerCase()} ${date}${label}`;
  }).join("; ");

  const categories = context.categories.length > 0 ? context.categories.join(", ") : "Другое";
  const nextMonday = addDays(context.today, ((1 - weekdayOf(context.today) + 7) % 7) || 7);
  const forced = context.forcedKind
    ? `\nПользователь явно выбрал тип: kind="${context.forcedKind}".`
    : "";

  const system = `Ты разбираешь сообщения для личного планера life hub и возвращаешь только JSON.
Сейчас ${WEEKDAY_FULL_LOWER[weekdayOf(context.today)]}, ${context.today}, ${context.now} (${context.timeZone}).
Ближайшие дни: ${days}.
Категории трат: ${categories}.

kind:
- expense — потрачены деньги, есть сумма: «кофе 250», «такси 600р», «заплатил за интернет 700».
- event — встреча, занятие или дело в конкретный день, обычно со временем: «завтра в 15 созвон», «в пятницу пара в 10:30 ауд. 402».
- task — что-то сделать, возможно к сроку: «сдать эссе до пятницы», «купить подарок маме». «до», «к», «дедлайн» — это срок задачи, а не событие.
- note — мысль, идея, конспект, ссылка, «запомни…», «заметка:…».
- unknown — приветствие, вопрос или непонятное; тогда в reply коротко по-русски скажи, что умеешь.

Поля:
- title — коротко, без даты, времени и суммы, с заглавной буквы.
- date — ГГГГ-ММ-ДД из списка ближайших дней: день события, срок задачи или день траты. Нет даты — "". День недели, совпадающий с сегодняшним («в ${WEEKDAY_ACCUSATIVE[weekdayOf(context.today)]}», «до ${WEEKDAY_GENITIVE[weekdayOf(context.today)]}»), — это через неделю, если не сказано «сегодня».
- start, end — ЧЧ:ММ, 24-часовой формат («в 7 вечера» = 19:00). Нет времени — "".
- amount — сумма траты в рублях числом, иначе 0.
- category — одна из категорий трат, иначе "".
- urgent — true, если срочно: сегодня-завтра, «срочно», «горит». important — true для важного (по умолчанию true).
- location — место, если названо. details — остальное полезное; для note — весь текст заметки.

Пример: «завтра в 7 вечера ужин с Настей в Кофемании» → {"kind":"event","title":"Ужин с Настей","date":"${addDays(context.today, 1)}","start":"19:00","end":"","amount":0,"category":"","urgent":false,"important":true,"location":"Кофемания","details":"","reply":""}
Пример: «такси до универа 540» → {"kind":"expense","title":"Такси до универа","date":"","start":"","end":"","amount":540,"category":"Транспорт","urgent":false,"important":true,"location":"","details":"","reply":""}
Пример: «сдать эссе к понедельнику» → {"kind":"task","title":"Сдать эссе","date":"${nextMonday}","start":"","end":"","amount":0,"category":"","urgent":false,"important":true,"location":"","details":"","reply":""}${forced}`;

  return [
    { role: "system", content: system },
    { role: "user", content: text },
  ];
}

// ─── Нормализация ────────────────────────────────────────────────────────────

type Raw = Record<string, unknown>;

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function multiline(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/** Длинное название: укоротить с «…», полный текст уходит в описание. */
function fitTitle(title: string, max: number): { title: string; overflow: string } {
  if (title.length <= max) return { title, overflow: "" };
  return { title: `${title.slice(0, max - 1).trimEnd()}…`, overflow: title };
}

/**
 * Дата из будущего контекста (срок, событие). Модели иногда путают год —
 * «2024-09-20» вместо текущего: такую дату переносим в ближайший будущий год.
 */
export function futureDate(value: unknown, today: IsoDate): IsoDate | "" {
  if (typeof value !== "string" || !isValidIso(value)) return "";
  const weekAgo = addDays(today, -7);
  if (value >= weekAgo) return value;

  const monthDay = value.slice(4);
  const thisYear = `${today.slice(0, 4)}${monthDay}`;
  if (isValidIso(thisYear) && thisYear >= weekAgo) return thisYear;
  const nextYear = `${Number(today.slice(0, 4)) + 1}${monthDay}`;
  return isValidIso(nextYear) ? nextYear : "";
}

/** Дата траты: не в будущем и не старше двух месяцев, иначе — сегодня. */
function pastDate(value: unknown, today: IsoDate): IsoDate {
  if (typeof value !== "string" || !isValidIso(value)) return today;
  if (value > today || value < addDays(today, -62)) return today;
  return value;
}

function fallbackTitle(original: string, max: number): string {
  return capitalize(text(original.replace(/^\/\w+(@\w+)?\s*/, ""), max));
}

export function normalizeIntent(raw: unknown, context: IntentContext): BotIntent {
  const data: Raw = raw && typeof raw === "object" ? (raw as Raw) : {};
  const declared = typeof data.kind === "string" ? data.kind : "unknown";
  const kind = context.forcedKind ?? declared;

  if (kind === "task") {
    const rawTitle = capitalize(text(data.title, 500)) || fallbackTitle(context.originalText, 500);
    if (!rawTitle) return { kind: "unknown", reply: "Как назвать задачу?" };
    const { title, overflow } = fitTitle(rawTitle, TASK_TITLE_MAX);
    const details = multiline(data.details, DETAILS_MAX);
    return {
      kind: "task",
      title,
      dueDate: futureDate(data.date, context.today),
      urgent: data.urgent === true,
      important: data.important !== false,
      description: [overflow, details].filter(Boolean).join("\n\n").slice(0, DETAILS_MAX),
    };
  }

  if (kind === "event") {
    const title = capitalize(text(data.title, EVENT_TITLE_MAX)) || fallbackTitle(context.originalText, EVENT_TITLE_MAX);
    if (!title) return { kind: "unknown", reply: "Как назвать дело?" };
    const startTime = normalizeTime(data.start);
    let endTime = startTime ? normalizeTime(data.end) : "";
    if (startTime && (!endTime || minutesOfDay(endTime) <= minutesOfDay(startTime))) {
      endTime = addMinutesCapped(startTime, 60);
    }
    return {
      kind: "event",
      title,
      date: futureDate(data.date, context.today) || context.today,
      startTime,
      endTime,
      location: text(data.location, PLACE_MAX),
      description: multiline(data.details, DETAILS_MAX),
    };
  }

  if (kind === "expense") {
    const amount = typeof data.amount === "number" ? data.amount : Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) {
      return { kind: "unknown", reply: "Не понял сумму. Напиши, например, «кофе 250»." };
    }
    return {
      kind: "expense",
      amount: Math.round(amount * 100) / 100,
      category: text(data.category, 60),
      note: capitalize(text(data.title, EXPENSE_NOTE_MAX)),
      date: pastDate(data.date, context.today),
    };
  }

  if (kind === "note") {
    const body = multiline(data.details, 50_000) || multiline(context.originalText.replace(/^\/\w+(@\w+)?\s*/, ""), 50_000);
    const title = capitalize(text(data.title, NOTE_TITLE_MAX));
    if (!body && !title) return { kind: "unknown", reply: "Заметка пустая — что записать?" };
    return { kind: "note", title, body };
  }

  return { kind: "unknown", reply: text(data.reply, 500) || UNKNOWN_REPLY };
}
