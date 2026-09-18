import type { CalendarEvent, IsoDate, Task } from "@/lib/types";
import { addDays, formatDayMonth, WEEKDAY_NAMES, WEEKDAY_SHORT, weekdayOf } from "@/lib/utils/date";
import { formatRub } from "@/lib/utils/format";

import type { BotIntent } from "./intent";

/**
 * Тексты сообщений бота — чистые функции, чтобы их можно было проверить тестом
 * и поменять формулировку, не трогая логику. Разметка — HTML Telegram: всё,
 * что пришло от пользователя, проходит через escapeHtml.
 */

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** «пт, 19 сентября» / «сегодня» / «завтра». */
export function humanDate(date: IsoDate, today: IsoDate): string {
  if (date === today) return "сегодня";
  if (date === addDays(today, 1)) return "завтра";
  if (date === addDays(today, -1)) return "вчера";
  return `${WEEKDAY_SHORT[weekdayOf(date)].toLowerCase()}, ${formatDayMonth(date)}`;
}

function timeRange(start: string, end: string): string {
  if (!start) return "весь день";
  return end ? `${start}–${end}` : start;
}

export const KIND_LABEL = {
  task: "Задача",
  event: "Дело в календаре",
  expense: "Трата",
  note: "Заметка",
} as const;

type SavedIntent = Exclude<BotIntent, { kind: "unknown" }>;

/** Одна строка для журнала бота в настройках: «Задача · Сдать эссе». */
export function intentSummary(intent: SavedIntent, categoryName = ""): string {
  if (intent.kind === "expense") {
    const what = intent.note || categoryName || "Трата";
    return `${KIND_LABEL.expense} · ${what} · ${formatRub(intent.amount)}`;
  }
  if (intent.kind === "note") {
    return `${KIND_LABEL.note} · ${intent.title || intent.body.slice(0, 60)}`;
  }
  return `${KIND_LABEL[intent.kind]} · ${intent.title}`;
}

/** Подтверждение записи. transcript — расшифровка, если пришло голосовое. */
export function formatSaved(
  intent: SavedIntent,
  today: IsoDate,
  extras: { categoryName?: string; transcript?: string; footnote?: string } = {},
): string {
  const lines: string[] = [];
  if (extras.transcript) lines.push(`🎙 <i>«${escapeHtml(extras.transcript)}»</i>`, "");

  if (intent.kind === "task") {
    lines.push(`✅ <b>Задача</b> — ${escapeHtml(intent.title)}`);
    lines.push(intent.dueDate ? `📅 Срок: ${humanDate(intent.dueDate, today)}` : "📅 Без срока");
    const flags = [intent.urgent ? "срочно" : "", intent.important ? "важно" : ""].filter(Boolean);
    if (flags.length > 0) lines.push(`${intent.urgent ? "🔥" : "⭐️"} ${flags.join(", ")}`);
  } else if (intent.kind === "event") {
    lines.push(`📅 <b>В календарь</b> — ${escapeHtml(intent.title)}`);
    lines.push(`🕒 ${humanDate(intent.date, today)}, ${timeRange(intent.startTime, intent.endTime)}`);
    if (intent.location) lines.push(`📍 ${escapeHtml(intent.location)}`);
  } else if (intent.kind === "expense") {
    lines.push(`💸 <b>Трата</b> — ${formatRub(intent.amount)}`);
    const where = [extras.categoryName, intent.note].filter(Boolean).map((part) => escapeHtml(part!));
    if (where.length > 0) lines.push(`🏷 ${where.join(" · ")}`);
    if (intent.date !== today) lines.push(`📅 ${humanDate(intent.date, today)}`);
  } else {
    lines.push(`📝 <b>Заметка</b>${intent.title ? ` — ${escapeHtml(intent.title)}` : ""}`);
    const preview = intent.body.length > 160 ? `${intent.body.slice(0, 159)}…` : intent.body;
    if (preview) lines.push(`<i>${escapeHtml(preview)}</i>`);
  }

  if (extras.footnote) lines.push("", `<i>${escapeHtml(extras.footnote)}</i>`);
  return lines.join("\n");
}

export const EXAMPLES = [
  "• <i>завтра в 15:00 созвон с Лизой</i> — в календарь",
  "• <i>сдать эссе по микре до пятницы</i> — задача со сроком",
  "• <i>кофе 250</i> — трата",
  "• <i>заметка: идея для курсовой…</i> — заметка",
  "• или просто надиктуй голосовое 🎙",
].join("\n");

export function formatWelcome(siteUrl: string): string {
  return [
    "👋 <b>Привет! Я бот life hub.</b>",
    "",
    "Записываю задачи, дела в календарь, траты и заметки прямо в твой life hub, а по утрам присылаю сводку дня.",
    "",
    "Чтобы начать, привяжи аккаунт: открой life hub → <b>Настройки</b> → <b>Telegram-бот</b> → «Подключить». Если аккаунта ещё нет — регистрация займёт минуту.",
    "",
    `<a href="${siteUrl}">${escapeHtml(siteUrl.replace(/^https?:\/\//, ""))}</a>`,
  ].join("\n");
}

export function formatHelp(digestTime: string | null): string {
  return [
    "<b>Что я умею</b>",
    "",
    "Пиши как человеку — я сам пойму, что это:",
    EXAMPLES,
    "",
    "Команды, если хочешь выбрать тип сам:",
    "/task, /event, /expense, /note — задача, дело, трата, заметка",
    "/today — сводка на сегодня",
    "/unlink — отвязать этот чат",
    "",
    digestTime
      ? `☀️ Сводка дня приходит каждое утро в ${digestTime}. Время меняется в настройках life hub.`
      : "☀️ Утренняя сводка выключена — включить можно в настройках life hub.",
  ].join("\n");
}

export function formatLinked(name: string, digestTime: string): string {
  return [
    `🎉 <b>Готово!</b> Этот чат привязан к аккаунту <b>${escapeHtml(name)}</b>.`,
    "",
    "Попробуй прямо сейчас:",
    EXAMPLES,
    "",
    `☀️ Каждое утро в ${digestTime} пришлю сводку: дела из календаря и задачи на день.`,
  ].join("\n");
}

// ─── Утренняя сводка ─────────────────────────────────────────────────────────

export interface DigestData {
  name: string;
  today: IsoDate;
  /** Местное время «HH:MM» — от него зависит приветствие; по умолчанию утро. */
  localTime?: string;
  events: CalendarEvent[];
  /** Невыполненные задачи со сроком сегодня. */
  dueToday: Task[];
  /** Невыполненные задачи со сроком раньше сегодняшнего. */
  overdue: Task[];
  /** Невыполненные задачи со сроком в ближайшие 6 дней после сегодняшнего. */
  upcoming: Task[];
}

const MAX_LIST = 6;

function taskLine(task: Task, today: IsoDate, withDate: boolean): string {
  const mark = task.urgent ? " 🔥" : "";
  const when = withDate && task.dueDate ? ` — ${humanDate(task.dueDate, today)}` : "";
  return `• ${escapeHtml(task.title)}${when}${mark}`;
}

function clip<T>(items: T[], render: (item: T) => string): string[] {
  const lines = items.slice(0, MAX_LIST).map(render);
  if (items.length > MAX_LIST) lines.push(`<i>…и ещё ${items.length - MAX_LIST}</i>`);
  return lines;
}

export function formatDigest(data: DigestData): string {
  const greetingName = data.name.trim() ? `, ${escapeHtml(data.name.trim().split(/\s+/)[0]!)}` : "";
  const weekday = WEEKDAY_NAMES[weekdayOf(data.today)];
  const hour = Number((data.localTime ?? "08:00").slice(0, 2));
  const greeting =
    hour >= 5 && hour < 12 ? "☀️ <b>Доброе утро" : hour >= 12 && hour < 18 ? "🌤 <b>Добрый день" : "🌙 <b>Добрый вечер";
  const lines = [`${greeting}${greetingName}!</b>`, `${weekday}, ${formatDayMonth(data.today)}`];

  const sortedEvents = [...data.events].sort((a, b) =>
    (a.startTime || "00:00").localeCompare(b.startTime || "00:00"),
  );
  if (sortedEvents.length > 0) {
    lines.push("", "📅 <b>Расписание</b>");
    lines.push(
      ...clip(sortedEvents, (event) => {
        const place = event.location ? ` · ${escapeHtml(event.location)}` : "";
        return `${timeRange(event.startTime, event.endTime)} — ${escapeHtml(event.title)}${place}`;
      }),
    );
  }

  if (data.dueToday.length > 0) {
    lines.push("", "✅ <b>Сделать сегодня</b>");
    lines.push(...clip(data.dueToday, (task) => taskLine(task, data.today, false)));
  }

  if (data.overdue.length > 0) {
    lines.push("", "⚠️ <b>Просрочено</b>");
    lines.push(...clip(data.overdue, (task) => taskLine(task, data.today, true)));
  }

  if (data.upcoming.length > 0) {
    lines.push("", "🗓 <b>Дальше на неделе</b>");
    lines.push(...clip(data.upcoming, (task) => taskLine(task, data.today, true)));
  }

  const empty =
    sortedEvents.length === 0 &&
    data.dueToday.length === 0 &&
    data.overdue.length === 0 &&
    data.upcoming.length === 0;
  lines.push("", empty ? "Сегодня ни дел, ни дедлайнов — свободный день 🌿" : "Хорошего дня!");

  return lines.join("\n");
}
