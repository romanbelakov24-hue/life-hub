import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CalendarEvent, Task } from "@/lib/types";

import { formatDigest, formatSaved } from "./format";
import { isDigestDue } from "./schedule";

const task = (title: string, dueDate: string, urgent = false): Task => ({
  id: title,
  title,
  description: "",
  dueDate,
  done: false,
  urgent,
  important: true,
  subject: "",
  createdAt: "2026-09-01T00:00:00Z",
  completedAt: null,
});

const event = (title: string, startTime: string, endTime: string): CalendarEvent => ({
  id: title,
  date: "2026-09-18",
  startTime,
  endTime,
  title,
  location: "",
  description: "",
  color: "#7e8894",
  createdAt: "2026-09-01T00:00:00Z",
});

describe("утренняя сводка", () => {
  it("расписание по времени, задачи по группам, без денег", () => {
    const text = formatDigest({
      name: "Роман Беляков",
      today: "2026-09-18",
      events: [event("Созвон", "15:00", "16:00"), event("Пара <микро>", "10:30", "12:00")],
      dueToday: [task("Сдать эссе", "2026-09-18", true)],
      overdue: [task("Прочитать главу", "2026-09-15")],
      upcoming: [task("Контрольная", "2026-09-21")],
    });

    assert.match(text, /Доброе утро, Роман!/);
    assert.match(text, /Пятница, 18 сентября/);
    // Сначала утренняя пара, потом дневной созвон.
    assert.ok(text.indexOf("10:30–12:00") < text.indexOf("15:00–16:00"));
    // Текст пользователя экранирован для HTML-разметки Telegram.
    assert.match(text, /Пара &lt;микро&gt;/);
    assert.match(text, /Сдать эссе 🔥/);
    assert.match(text, /Прочитать главу — вт, 15 сентября/);
    assert.match(text, /Контрольная — пн, 21 сентября/);
    assert.doesNotMatch(text, /₽/);
  });

  it("пустой день — одна тёплая строка вместо пустых разделов", () => {
    const text = formatDigest({ name: "", today: "2026-09-18", events: [], dueToday: [], overdue: [], upcoming: [] });
    assert.match(text, /свободный день/);
    assert.doesNotMatch(text, /Расписание|Просрочено/);
  });
});

describe("когда слать сводку", () => {
  const schedule = { digestEnabled: true, digestTime: "08:00", lastDigestDate: "", timezone: "Europe/Moscow" };
  // 05:10 UTC = 08:10 в Москве.
  const at = (iso: string) => new Date(iso);

  it("в первые минуты после выбранного времени — пора", () => {
    assert.deepEqual(isDigestDue(schedule, at("2026-09-18T05:10:00Z")), { due: true, localDate: "2026-09-18" });
  });

  it("до выбранного времени — рано", () => {
    assert.equal(isDigestDue(schedule, at("2026-09-18T04:50:00Z")).due, false);
  });

  it("уже отправлено сегодня — не повторять", () => {
    assert.equal(isDigestDue({ ...schedule, lastDigestDate: "2026-09-18" }, at("2026-09-18T05:10:00Z")).due, false);
  });

  it("включили вечером — утренняя сводка не приходит внезапно", () => {
    assert.equal(isDigestDue(schedule, at("2026-09-18T17:00:00Z")).due, false);
  });

  it("часовой пояс пользователя, а не сервера", () => {
    // 08:05 во Владивостоке (UTC+10) — это 22:05 UTC предыдущего дня.
    const vladivostok = { ...schedule, timezone: "Asia/Vladivostok" };
    assert.deepEqual(isDigestDue(vladivostok, at("2026-09-17T22:05:00Z")), { due: true, localDate: "2026-09-18" });
  });

  it("выключена — никогда", () => {
    assert.equal(isDigestDue({ ...schedule, digestEnabled: false }, at("2026-09-18T05:10:00Z")).due, false);
  });
});

describe("подтверждение записи", () => {
  it("голосовое показывает расшифровку, трата — категорию", () => {
    const text = formatSaved(
      { kind: "expense", amount: 250, category: "Еда", note: "Кофе", date: "2026-09-18" },
      "2026-09-18",
      { categoryName: "Еда", transcript: "кофе двести пятьдесят" },
    );
    assert.match(text, /🎙 <i>«кофе двести пятьдесят»<\/i>/);
    assert.match(text, /250/);
    assert.match(text, /Еда · Кофе/);
  });
});

describe("приветствие сводки", () => {
  const empty = { name: "Роман", today: "2026-09-18", events: [], dueToday: [], overdue: [], upcoming: [] };
  it("по местному времени: утро, день, вечер", () => {
    assert.match(formatDigest({ ...empty, localTime: "08:00" }), /Доброе утро, Роман/);
    assert.match(formatDigest({ ...empty, localTime: "15:40" }), /Добрый день, Роман/);
    assert.match(formatDigest({ ...empty, localTime: "21:10" }), /Добрый вечер, Роман/);
  });
});
