/**
 * Генератор календарной ленты в формате iCalendar (RFC 5545).
 *
 * Зачем именно лента, а не API: у Apple нет публичного интерфейса, через
 * который сторонний сервис мог бы писать в Календарь. Зато и Apple Calendar,
 * и Google Calendar, и Outlook умеют подписываться на URL и periodически его
 * перечитывать. Один файл закрывает все три клиента и не требует OAuth.
 *
 * Синхронизация односторонняя: life hub → календарь. Правки, сделанные в
 * календаре, обратно не приедут — подписка доступна только для чтения.
 *
 * Что попадает в ленту:
 *   • пары из расписания — еженедельно повторяющимися событиями;
 *   • задачи с дедлайном — событиями на весь день.
 */

import { PAIRS_PER_DAY, resolvePairTime } from "@/config/schedule";
import type { ScheduleSlot, Task, Weekday } from "@/lib/types";

/** Коды дней недели в RRULE. Индекс — ISO-номер дня (1 = понедельник). */
const BYDAY: Record<Weekday, string> = {
  1: "MO",
  2: "TU",
  3: "WE",
  4: "TH",
  5: "FR",
  6: "SA",
  7: "SU",
};

/**
 * Опорная дата серии — понедельник 1 января 2024 года.
 *
 * Она намеренно фиксированная и в прошлом: если считать «ближайший такой день
 * недели», DTSTART съезжал бы при каждом запросе ленты, и клиент видел бы новую
 * серию вместо прежней.
 */
const SERIES_ANCHOR = new Date(2024, 0, 1);

// ─── Примитивы формата ───────────────────────────────────────────────────────

/** Экранирование спецсимволов в текстовых полях (RFC 5545, §3.3.11). */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Свёртка длинных строк: не больше 75 октетов, продолжение начинается с пробела.
 *
 * Считать нужно именно байты в UTF-8, а не символы: кириллица занимает по два
 * байта, и наивный подсчёт по длине строки даст строки вдвое длиннее нормы.
 * Резать при этом можно только по границам символов — иначе многобайтовая
 * последовательность разорвётся пополам и клиент увидит мусор.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  // Первая строка — 75 октетов, продолжения на один меньше из-за ведущего пробела.
  let limit = 75;

  for (const char of line) {
    const charBytes = encoder.encode(char).length;

    if (currentBytes + charBytes > limit) {
      chunks.push(current);
      current = "";
      currentBytes = 0;
      limit = 74;
    }

    current += char;
    currentBytes += charBytes;
  }

  if (current) chunks.push(current);

  return chunks.map((chunk, index) => (index === 0 ? chunk : ` ${chunk}`)).join("\r\n");
}

/** `2026-09-01` + `08:30` → `20260901T083000` (локальное «плавающее» время). */
function toFloatingDateTime(date: Date, time: string): string {
  const [hours = "0", minutes = "0"] = time.split(":");

  return (
    `${date.getFullYear()}` +
    `${String(date.getMonth() + 1).padStart(2, "0")}` +
    `${String(date.getDate()).padStart(2, "0")}` +
    `T${hours.padStart(2, "0")}${minutes.padStart(2, "0")}00`
  );
}

/** `2026-09-05` → `20260905` — для событий на весь день. */
function toDateValue(iso: string): string {
  return iso.replace(/-/g, "");
}

/** Метка формирования файла — всегда в UTC. */
function timestampUtc(): string {
  return `${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

/** Дата опорного дня недели: понедельник-якорь плюс смещение. */
function anchorDateFor(weekday: Weekday): Date {
  const date = new Date(SERIES_ANCHOR);
  date.setDate(date.getDate() + (weekday - 1));
  return date;
}

/** Прибавляет день: DTEND у события на весь день не включается в интервал. */
function nextDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + 1);
  return toDateValue(
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate(),
    ).padStart(2, "0")}`,
  );
}

// ─── Сборка событий ──────────────────────────────────────────────────────────

interface BuildOptions {
  slots: ScheduleSlot[];
  tasks: Task[];
  /**
   * За сколько минут до начала пары напомнить.
   * Apple Calendar уважает VALARM в подписке, если при добавлении не поставить
   * галочку «Удалить напоминания». Google Calendar напоминания из чужих лент
   * игнорирует и применяет собственные настройки календаря.
   */
  lessonReminderMinutes?: number;
  /** За сколько часов до конца дня напомнить о дедлайне задачи. */
  taskReminderHours?: number;
}

export function buildCalendar({
  slots,
  tasks,
  lessonReminderMinutes = 15,
  taskReminderHours = 3,
}: BuildOptions): string {
  const stamp = timestampUtc();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//life hub//calendar feed//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:life hub",
    "X-WR-CALDESC:Расписание пар и дедлайны задач",
    // Подсказка клиенту, как часто перечитывать ленту. Apple ориентируется на
    // REFRESH-INTERVAL, Google — на собственное расписание (обычно раз в сутки).
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  // ─── Пары: еженедельные повторяющиеся события ───────────────────────────────
  for (const slot of slots) {
    if (!slot.subject.trim()) continue;
    if (slot.pairIndex < 1 || slot.pairIndex > PAIRS_PER_DAY) continue;

    const { start, end } = resolvePairTime(slot.pairIndex, slot.startTime, slot.endTime);
    if (!start || !end) continue;

    const anchor = anchorDateFor(slot.weekday);
    const description = [slot.teacher, `${slot.pairIndex}-я пара`]
      .filter(Boolean)
      .join(" · ");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${slot.id}@life-hub`,
      `DTSTAMP:${stamp}`,
      // Без TZID и без Z — «плавающее» время. Для расписания пар это правильно:
      // 08:30 означает 08:30 по часам устройства, где бы оно ни находилось.
      `DTSTART:${toFloatingDateTime(anchor, start)}`,
      `DTEND:${toFloatingDateTime(anchor, end)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[slot.weekday]}`,
      `SUMMARY:${escapeText(slot.subject)}`,
    );

    if (slot.room.trim()) lines.push(`LOCATION:${escapeText(slot.room)}`);
    if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);

    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `TRIGGER:-PT${lessonReminderMinutes}M`,
      `DESCRIPTION:${escapeText(slot.subject)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }

  // ─── Дедлайны задач: события на весь день ───────────────────────────────────
  for (const task of tasks) {
    if (task.done || !task.dueDate) continue;

    const description = [task.subject, task.description].filter(Boolean).join("\n\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${task.id}@life-hub`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${toDateValue(task.dueDate)}`,
      // DTEND у события на весь день указывает на следующий день — конец
      // интервала в iCalendar не включается.
      `DTEND;VALUE=DATE:${nextDay(task.dueDate)}`,
      `SUMMARY:${escapeText(`Дедлайн: ${task.title}`)}`,
    );

    if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);

    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `TRIGGER:-PT${taskReminderHours}H`,
      `DESCRIPTION:${escapeText(task.title)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");

  // Разделитель строк в iCalendar — строго CRLF.
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
