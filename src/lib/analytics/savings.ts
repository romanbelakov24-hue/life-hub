/**
 * Аналитика целей накоплений — чистые функции без обращений к базе.
 * Тот же принцип, что и в analytics/expenses.ts: считать поверх уже
 * загруженных строк, а не плодить SQL-агрегаты.
 */

import type { IsoDate, SavingsContribution, SavingsGoal, SavingsGoalStatus } from "@/lib/types";
import { daysBetween } from "@/lib/utils/date";
import { roundTo } from "@/lib/utils/format";

/** Дней в среднем месяце — для перевода «осталось N дней» в темп «в месяц». */
const DAYS_PER_MONTH = 30.44;

/**
 * Цели вместе с посчитанным прогрессом.
 *
 * Строится из всех целей, а не только тех, где уже есть пополнения: цель без
 * единого взноса должна показать «0 из суммы», а не пропасть из списка.
 *
 * Порядок: сперва недостигнутые (у кого есть срок — по возрастанию срока,
 * дальше — по проценту выполнения, кто ближе к цели), достигнутые — в конце.
 */
export function buildSavingsGoalStatuses(
  goals: SavingsGoal[],
  contributions: SavingsContribution[],
  today: IsoDate,
): SavingsGoalStatus[] {
  const savedByGoal = new Map<string, number>();
  for (const contribution of contributions) {
    savedByGoal.set(
      contribution.goalId,
      roundTo((savedByGoal.get(contribution.goalId) ?? 0) + contribution.amount, 2),
    );
  }

  const statuses = goals.map((goal) => {
    const saved = savedByGoal.get(goal.id) ?? 0;
    const remaining = roundTo(goal.targetAmount - saved, 2);
    const achieved = remaining <= 0;
    const daysLeft = goal.targetDate ? daysBetween(today, goal.targetDate) : null;

    const suggestedMonthly =
      !achieved && daysLeft !== null && daysLeft > 0
        ? roundTo((remaining / daysLeft) * DAYS_PER_MONTH, 2)
        : null;

    return {
      goalId: goal.id,
      name: goal.name,
      color: goal.color,
      icon: goal.icon,
      targetAmount: goal.targetAmount,
      targetDate: goal.targetDate,
      saved,
      remaining,
      percent: goal.targetAmount > 0 ? roundTo((saved / goal.targetAmount) * 100, 0) : 0,
      achieved,
      daysLeft,
      suggestedMonthly,
    };
  });

  return statuses.sort((a, b) => {
    if (a.achieved !== b.achieved) return a.achieved ? 1 : -1;
    if (a.targetDate && b.targetDate) return a.targetDate.localeCompare(b.targetDate);
    if (a.targetDate) return -1;
    if (b.targetDate) return 1;
    return b.percent - a.percent;
  });
}

/** Сумма всех пополнений — для сводной цифры «отложено всего». */
export function sumContributions(contributions: SavingsContribution[]): number {
  return roundTo(
    contributions.reduce((total, contribution) => total + contribution.amount, 0),
    2,
  );
}
