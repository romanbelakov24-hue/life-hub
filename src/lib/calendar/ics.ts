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
 *   • дела из календаря — у каждого своя настоящая дата, поэтому одно дело —
 *     ровно одно VEVENT, без повторения и без окна дат;
 *   • задачи с дедлайном — событиями на весь день.
 *
 * Пары ВШЭ сюда не попадают — они синхронизируются у владельца напрямую из
 * ЛК в Apple/Google Календарь, отдельным путём, минуя life hub.
 */

import type { CalendarEvent, Task } from "@/lib/types";

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
function toFloatingDateTime(iso: string, time: string): string {
  const [hours = "0", minutes = "0"] = time.split(":");
  return `${toDateValue(iso)}T${hours.padStart(2, "0")}${minutes.padStart(2, "0")}00`;
}

/** `2026-09-05` → `20260905` — для событий на весь день. */
function toDateValue(iso: string): string {
  return iso.replace(/-/g, "");
}

/** Метка формирования файла — всегда в UTC. */
function timestampUtc(): string {
  return `${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
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
  events: CalendarEvent[];
  tasks: Task[];
  /** За сколько минут до начала дела напомнить (только у дел с указанным временем). */
  eventReminderMinutes?: number;
  /** За сколько часов до конца дня напомнить о дедлайне задачи. */
  taskReminderHours?: number;
}

export function buildCalendar({
  events,
  tasks,
  eventReminderMinutes = 15,
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
    "X-WR-CALDESC:Дела и дедлайны задач",
    // Подсказка клиенту, как часто перечитывать ленту. Apple ориентируется на
    // REFRESH-INTERVAL, Google — на собственное расписание (обычно раз в сутки).
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  // ─── Дела: у каждого уже своя настоящая дата — ровно одно VEVENT на дело ────
  for (const event of events) {
    if (!event.title.trim()) continue;

    const description = [event.location, event.description].filter(Boolean).join("\n\n");
    const hasTime = event.startTime !== "" && event.endTime !== "";

    lines.push("BEGIN:VEVENT", `UID:${event.id}@life-hub`, `DTSTAMP:${stamp}`);

    if (hasTime) {
      // Без TZID и без Z — «плавающее» время: 18:00 значит 18:00 по часам
      // устройства, где бы оно ни находилось.
      lines.push(
        `DTSTART:${toFloatingDateTime(event.date, event.startTime)}`,
        `DTEND:${toFloatingDateTime(event.date, event.endTime)}`,
      );
    } else {
      lines.push(
        `DTSTART;VALUE=DATE:${toDateValue(event.date)}`,
        `DTEND;VALUE=DATE:${nextDay(event.date)}`,
      );
    }

    lines.push(`SUMMARY:${escapeText(event.title)}`);

    if (event.location.trim()) lines.push(`LOCATION:${escapeText(event.location)}`);
    if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);

    // Напоминание — только если у дела есть время: для события на весь день
    // «за 15 минут до полуночи» не несёт смысла.
    if (hasTime) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `TRIGGER:-PT${eventReminderMinutes}M`,
        `DESCRIPTION:${escapeText(event.title)}`,
        "END:VALARM",
      );
    }

    lines.push("END:VEVENT");
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
