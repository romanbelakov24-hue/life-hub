import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildBudgetForecast } from "./budget";

describe("прогноз бюджета", () => {
  it("делит остаток на оставшиеся дни, считая сегодняшний", () => {
    // Сентябрь — 30 дней; 21-е число → осталось 10 дней, включая сегодня.
    const forecast = buildBudgetForecast({
      income: 40000,
      spent: 30000,
      today: "2026-09-21",
      monthAnchor: "2026-09-01",
      historicalDailyRate: null,
    });
    assert.equal(forecast.daysLeft, 10);
    assert.equal(forecast.remaining, 10000);
    assert.equal(forecast.dailyAllowance, 1000);
  });

  it("без дохода дневной лимит не считается", () => {
    const forecast = buildBudgetForecast({
      income: 0,
      spent: 1200,
      today: "2026-09-05",
      monthAnchor: "2026-09-05",
      historicalDailyRate: null,
    });
    assert.equal(forecast.dailyAllowance, null);
  });

  it("при перерасходе лимит ноль, а не минус", () => {
    const forecast = buildBudgetForecast({
      income: 10000,
      spent: 12000,
      today: "2026-09-10",
      monthAnchor: "2026-09-10",
      historicalDailyRate: null,
    });
    assert.equal(forecast.remaining, -2000);
    assert.equal(forecast.dailyAllowance, 0);
  });

  it("прошлый месяц закрыт: дней не осталось", () => {
    const forecast = buildBudgetForecast({
      income: 10000,
      spent: 9000,
      today: "2026-09-10",
      monthAnchor: "2026-08-15",
      historicalDailyRate: null,
    });
    assert.equal(forecast.daysLeft, 0);
    assert.equal(forecast.dailyAllowance, null);
  });
});
