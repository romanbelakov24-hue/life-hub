import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { IntentContext, IntentKind } from "./intent";
import { parseByRules } from "./rules";

// 18.09.2026 — пятница.
const context = (text: string, forcedKind?: IntentKind): IntentContext => ({
  today: "2026-09-18",
  now: "09:30",
  timeZone: "Europe/Moscow",
  categories: ["Магазин", "Еда", "Транспорт", "Другое"],
  originalText: text,
  forcedKind,
});

const parse = (text: string, forcedKind?: IntentKind) => parseByRules(text, context(text, forcedKind));

describe("разбор без ИИ", () => {
  it("«кофе 250» — трата", () => {
    assert.deepEqual(parse("кофе 250"), {
      kind: "expense",
      amount: 250,
      category: "",
      note: "Кофе",
      date: "2026-09-18",
    });
  });

  it("«такси 1 200р» — сумма с пробелом и рублями", () => {
    const intent = parse("такси 1 200р");
    assert.equal(intent.kind, "expense");
    if (intent.kind === "expense") assert.equal(intent.amount, 1200);
  });

  it("«завтра в 15 созвон с Лизой» — дело на час", () => {
    assert.deepEqual(parse("завтра в 15 созвон с Лизой"), {
      kind: "event",
      title: "Созвон с Лизой",
      date: "2026-09-19",
      startTime: "15:00",
      endTime: "16:00",
      location: "",
      description: "",
    });
  });

  it("«в 7 вечера ужин» — вечер переводится в 19:00, дата — сегодня", () => {
    const intent = parse("в 7 вечера ужин");
    assert.equal(intent.kind, "event");
    if (intent.kind === "event") {
      assert.equal(intent.startTime, "19:00");
      assert.equal(intent.date, "2026-09-18");
    }
  });

  it("«21.09 с 10:30 до 12:00 пара» — дата через точку не путается со временем", () => {
    const intent = parse("21.09 с 10:30 до 12:00 пара");
    assert.equal(intent.kind, "event");
    if (intent.kind === "event") {
      assert.equal(intent.date, "2026-09-21");
      assert.equal(intent.startTime, "10:30");
      assert.equal(intent.endTime, "12:00");
      assert.equal(intent.title, "Пара");
    }
  });

  it("«сдать эссе до пятницы» в пятницу — задача на следующую пятницу", () => {
    const intent = parse("сдать эссе до пятницы");
    assert.equal(intent.kind, "task");
    if (intent.kind === "task") {
      assert.equal(intent.title, "Сдать эссе");
      assert.equal(intent.dueDate, "2026-09-25");
    }
  });

  it("«подготовиться к экзамену 3 октября» — срок по названию месяца", () => {
    const intent = parse("подготовиться к экзамену 3 октября");
    assert.equal(intent.kind, "task");
    if (intent.kind === "task") assert.equal(intent.dueDate, "2026-10-03");
  });

  it("просто число без слов — не трата", () => {
    assert.equal(parse("42").kind, "task");
  });

  it("/note сохраняет весь текст заметкой", () => {
    assert.deepEqual(parse("/note идея: кружок по data science в 18:00", "note"), {
      kind: "note",
      title: "",
      body: "идея: кружок по data science в 18:00",
    });
  });

  it("/expense без суммы — переспрашивает", () => {
    assert.equal(parse("/expense обед", "expense").kind, "unknown");
  });
});
