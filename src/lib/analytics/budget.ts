/**
 * Прогноз бюджета — чистая функция без обращений к базе.
 *
 * Задача: ответить на вопрос «сколько можно тратить в день, чтобы дожить до
 * конца месяца на то, что пришло». И отдельно — предупредить, если при
 * нынешнем темпе денег не хватит.
 */

import type { BudgetForecast, IsoDate } from "@/lib/types";
import { endOfMonth, fromIso } from "@/lib/utils/date";
import { roundTo } from "@/lib/utils/format";

interface BudgetInput {
  income: number;
  spent: number;
  /** Сегодняшняя дата — от неё считаются прошедшие и оставшиеся дни. */
  today: IsoDate;
  /** Любая дата месяца, за который считаем. */
  monthAnchor: IsoDate;
  /** Средний расход в день за прошлые месяцы; null — истории нет. */
  historicalDailyRate: number | null;
}

export function buildBudgetForecast({
  income,
  spent,
  today,
  monthAnchor,
  historicalDailyRate,
}: BudgetInput): BudgetForecast {
  const daysInMonth = fromIso(endOfMonth(monthAnchor)).getDate();

  const isCurrentMonth = today.slice(0, 7) === monthAnchor.slice(0, 7);
  const dayOfMonth = isCurrentMonth ? fromIso(today).getDate() : daysInMonth;

  // Сегодняшний день считаем оставшимся: тратить в него ещё можно.
  const daysLeft = isCurrentMonth ? daysInMonth - dayOfMonth + 1 : 0;
  const daysElapsed = Math.max(dayOfMonth, 1);

  const remaining = roundTo(income - spent, 2);
  const currentDailyRate = roundTo(spent / daysElapsed, 2);

  // Прогноз строим по истории прошлых месяцев, а если её нет — по текущему
  // темпу. История устойчивее: в начале месяца текущий темп скачет от одной
  // крупной покупки.
  const rateForForecast = historicalDailyRate ?? currentDailyRate;

  const projectedTotal = isCurrentMonth
    ? roundTo(spent + rateForForecast * Math.max(daysLeft - 1, 0), 2)
    : roundTo(spent, 2);

  return {
    income: roundTo(income, 2),
    spent: roundTo(spent, 2),
    remaining,
    daysLeft,
    // Без занесённого дохода дневной лимит посчитать не из чего.
    dailyAllowance:
      income > 0 && daysLeft > 0 ? roundTo(Math.max(remaining, 0) / daysLeft, 2) : null,
    currentDailyRate,
    historicalDailyRate:
      historicalDailyRate === null ? null : roundTo(historicalDailyRate, 2),
    projectedTotal,
    projectedBalance: income > 0 ? roundTo(income - projectedTotal, 2) : null,
  };
}
