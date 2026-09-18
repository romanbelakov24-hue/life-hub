import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { futureDate, normalizeIntent, type IntentContext } from "./intent";

const context: IntentContext = {
  today: "2026-09-18",
  now: "09:30",
  timeZone: "Europe/Moscow",
  categories: ["Еда", "Другое"],
  originalText: "исходный текст",
};

describe("ответ модели → запись", () => {
  it("событие без конца длится час, время приводится к ЧЧ:ММ", () => {
    const intent = normalizeIntent(
      { kind: "event", title: "созвон", date: "2026-09-19", start: "9:00", end: "" },
      context,
    );
    assert.deepEqual(intent, {
      kind: "event",
      title: "Созвон",
      date: "2026-09-19",
      startTime: "09:00",
      endTime: "10:00",
      location: "",
      description: "",
    });
  });

  it("конец раньше начала — чинится, «25:00» — выбрасывается", () => {
    const early = normalizeIntent({ kind: "event", title: "Пара", start: "14:00", end: "13:00" }, context);
    assert.equal(early.kind === "event" && early.endTime, "15:00");

    const broken = normalizeIntent({ kind: "event", title: "Пара", start: "25:00" }, context);
    assert.equal(broken.kind === "event" && broken.startTime, "");
    assert.equal(broken.kind === "event" && broken.date, "2026-09-18");
  });

  it("длинное название задачи укорачивается, полный текст уходит в описание", () => {
    const long = "а".repeat(200);
    const intent = normalizeIntent({ kind: "task", title: long }, context);
    assert.equal(intent.kind, "task");
    if (intent.kind === "task") {
      assert.equal(intent.title.length, 160);
      assert.ok(intent.title.endsWith("…"));
      assert.ok(intent.description.startsWith("А".concat("а".repeat(10))));
    }
  });

  it("трата без суммы — вопрос, а не запись", () => {
    assert.equal(normalizeIntent({ kind: "expense", title: "обед", amount: 0 }, context).kind, "unknown");
    assert.equal(normalizeIntent({ kind: "expense", title: "обед", amount: "abc" }, context).kind, "unknown");
  });

  it("трата «из будущего» записывается сегодняшним днём", () => {
    const intent = normalizeIntent({ kind: "expense", title: "кофе", amount: 250, date: "2026-12-01" }, context);
    assert.equal(intent.kind === "expense" && intent.date, "2026-09-18");
  });

  it("команда задаёт тип поверх ответа модели", () => {
    const intent = normalizeIntent(
      { kind: "event", title: "Купить билеты", date: "2026-09-20" },
      { ...context, forcedKind: "task" },
    );
    assert.equal(intent.kind, "task");
    assert.equal(intent.kind === "task" && intent.dueDate, "2026-09-20");
  });

  it("мусор вместо JSON — «не понял» с подсказкой", () => {
    const intent = normalizeIntent("какой-то текст", context);
    assert.equal(intent.kind, "unknown");
  });
});

describe("год в дате", () => {
  it("прошлый год, который модель подставила по ошибке, переносится вперёд", () => {
    assert.equal(futureDate("2024-09-25", "2026-09-18"), "2026-09-25");
    assert.equal(futureDate("2025-01-10", "2026-09-18"), "2027-01-10");
  });

  it("недавнее прошлое (до недели) остаётся как есть", () => {
    assert.equal(futureDate("2026-09-15", "2026-09-18"), "2026-09-15");
  });

  it("не дата — пусто", () => {
    assert.equal(futureDate("завтра", "2026-09-18"), "");
  });
});
