import type { IsoDate } from "@/lib/types";
import { addDays, isValidIso, weekdayOf } from "@/lib/utils/date";
import { parseAmount } from "@/lib/utils/format";

import { normalizeIntent, type BotIntent, type IntentContext } from "./intent";

/**
 * Разбор без ИИ — на случай, когда квота Workers AI кончилась, модель не
 * ответила или сайт запущен локально без привязки к Cloudflare. Понимает
 * частые шаблоны: «кофе 250», «завтра в 15:00 созвон», «сдать эссе до
 * пятницы», «21.09 в 10:30 пара». Всё остальное становится задачей — это самое
 * безобидное место, откуда запись легко перенести руками.
 */

/** Границы слова для кириллицы: \b в JS знает только латиницу. */
const L = "(?<![\\p{L}\\d])";
const R = "(?![\\p{L}\\d])";
const PREP = "(?:(?:в|во|до|к|ко|на|с|со)\\s+)?";

function wordRe(body: string): RegExp {
  return new RegExp(`${L}${PREP}(?:${body})${R}`, "iu");
}

const WEEKDAYS: Array<[RegExp, number]> = [
  [wordRe("понедельник\\p{L}*|пн"), 1],
  [wordRe("вторник\\p{L}*|вт"), 2],
  [wordRe("сред[ауы]|ср"), 3],
  [wordRe("четверг\\p{L}*|чт"), 4],
  [wordRe("пятниц[аыу]|пт"), 5],
  [wordRe("суббот[аыу]|сб"), 6],
  [wordRe("воскресень[ея]|вс"), 7],
];

const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

interface Extracted {
  rest: string;
  date: IsoDate | "";
  start: string;
  end: string;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** День и месяц без года — ближайшая такая дата не раньше сегодняшней. */
function upcomingDayMonth(day: number, month: number, today: IsoDate): IsoDate | "" {
  const year = Number(today.slice(0, 4));
  for (const candidateYear of [year, year + 1]) {
    const iso = `${candidateYear}-${pad(month)}-${pad(day)}`;
    if (isValidIso(iso) && iso >= today) return iso;
  }
  return "";
}

function cut(source: string, match: RegExpExecArray): string {
  return `${source.slice(0, match.index)} ${source.slice(match.index + match[0].length)}`;
}

export function extractDateTime(input: string, today: IsoDate): Extracted {
  let rest = input;
  let date: IsoDate | "" = "";
  let start = "";
  let end = "";

  // Время: «с 10:00 до 11:30», «10:00-11:30», «в 15:00», «в 15.30», «в 7 вечера», «в 15».
  // Точка как разделитель — только после предлога: «21.09» без него — это дата.
  const range = new RegExp(
    `${L}(?:с\\s+)?([01]?\\d|2[0-3]):([0-5]\\d)\\s*(?:-|–|—|до)\\s*([01]?\\d|2[0-3]):([0-5]\\d)${R}`,
    "iu",
  ).exec(rest);
  if (range) {
    start = `${pad(Number(range[1]))}:${range[2]}`;
    end = `${pad(Number(range[3]))}:${range[4]}`;
    rest = cut(rest, range);
  } else {
    const exact =
      new RegExp(`${L}(?:(?:в|к|с)\\s+)?([01]?\\d|2[0-3]):([0-5]\\d)${R}`, "iu").exec(rest) ??
      new RegExp(`${L}(?:в|к|с)\\s+([01]?\\d|2[0-3])\\.([0-5]\\d)${R}`, "iu").exec(rest);
    if (exact) {
      start = `${pad(Number(exact[1]))}:${exact[2]}`;
      rest = cut(rest, exact);
    } else {
      const hour = new RegExp(
        `${L}(?:в|к)\\s+([01]?\\d|2[0-3])(?:\\s*(утра|дня|вечера|ночи))?${R}(?!\\s*(?:р|руб|₽|тыс|к${R}))`,
        "iu",
      ).exec(rest);
      if (hour) {
        let value = Number(hour[1]);
        const part = hour[2]?.toLowerCase();
        if ((part === "дня" || part === "вечера") && value < 12) value += 12;
        if (part === "ночи" && value === 12) value = 0;
        start = `${pad(value)}:00`;
        rest = cut(rest, hour);
      }
    }
  }

  // Дата: «послезавтра» раньше «завтра» — иначе «завтра» съест его хвост.
  const relative: Array<[RegExp, number]> = [
    [wordRe("послезавтра"), 2],
    [wordRe("завтра"), 1],
    [wordRe("сегодня"), 0],
  ];
  for (const [pattern, offset] of relative) {
    const match = pattern.exec(rest);
    if (match) {
      date = addDays(today, offset);
      rest = cut(rest, match);
      break;
    }
  }

  if (!date) {
    const numeric = new RegExp(`${L}${PREP}(\\d{1,2})\\.(\\d{1,2})(?:\\.(\\d{2,4}))?${R}`, "iu").exec(rest);
    if (numeric) {
      const day = Number(numeric[1]);
      const month = Number(numeric[2]);
      const yearRaw = numeric[3];
      if (yearRaw) {
        const year = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw);
        const iso = `${year}-${pad(month)}-${pad(day)}`;
        if (isValidIso(iso)) date = iso;
      } else {
        date = upcomingDayMonth(day, month, today);
      }
      if (date) rest = cut(rest, numeric);
    }
  }

  if (!date) {
    const named = new RegExp(`${L}${PREP}(\\d{1,2})\\s+(${MONTHS_GENITIVE.join("|")})${R}`, "iu").exec(rest);
    if (named?.[2]) {
      date = upcomingDayMonth(Number(named[1]), MONTHS_GENITIVE.indexOf(named[2].toLowerCase()) + 1, today);
      if (date) rest = cut(rest, named);
    }
  }

  if (!date) {
    for (const [pattern, weekday] of WEEKDAYS) {
      const match = pattern.exec(rest);
      if (!match) continue;
      // «В пятницу», сказанное в пятницу, — следующая пятница.
      const ahead = ((weekday - weekdayOf(today) + 7) % 7) || 7;
      date = addDays(today, ahead);
      rest = cut(rest, match);
      break;
    }
  }

  return { rest, date, start, end };
}

/** Сумма: «250», «1 200», «99,90», с «р», «руб», «₽» или без. */
function extractAmount(input: string): { amount: number | null; rest: string } {
  const match = new RegExp(
    `${L}(\\d{1,3}(?:[  ]\\d{3})+|\\d+)(?:[.,](\\d{1,2}))?\\s*(?:р\\.?|руб\\.?|рублей|рубля|₽)?${R}`,
    "iu",
  ).exec(input);
  if (!match) return { amount: null, rest: input };
  const amount = parseAmount(`${match[1]}${match[2] ? `,${match[2]}` : ""}`);
  return { amount, rest: cut(input, match) };
}

function tidy(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[\s,.;:—–-]+|[\s,.;:—–-]+$/g, "")
    .replace(new RegExp(`${L}(?:в|во|до|к|ко|на|с|со)$`, "iu"), "")
    .trim();
}

export function parseByRules(input: string, context: IntentContext): BotIntent {
  const body = input.replace(/^\/\w+(@\w+)?\s*/, "").trim();
  if (!body) return normalizeIntent({ kind: "unknown" }, context);

  const { rest, date, start, end } = extractDateTime(body, context.today);
  const forced = context.forcedKind;

  if (forced === "note") {
    return normalizeIntent({ kind: "note", title: "", details: body }, context);
  }

  const wantsExpense = forced === "expense" || (!forced && !start);
  if (wantsExpense) {
    const { amount, rest: withoutAmount } = extractAmount(rest);
    const note = tidy(withoutAmount);
    // Одно число без слов — скорее «помни 42», чем трата: трата без описания
    // бесполезна в журнале.
    if (amount !== null && (note || forced === "expense")) {
      return normalizeIntent(
        { kind: "expense", title: note, amount, date: date || context.today, category: "" },
        context,
      );
    }
    if (forced === "expense") return normalizeIntent({ kind: "expense", amount: 0 }, context);
  }

  const title = tidy(rest);
  if (forced === "event" || (!forced && start)) {
    return normalizeIntent({ kind: "event", title, date, start, end }, context);
  }
  return normalizeIntent({ kind: "task", title, date }, { ...context, forcedKind: "task" });
}
