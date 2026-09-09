import { ArrowUpRight, Check, PiggyBank } from "lucide-react";
import Link from "next/link";

import { ShareBar } from "@/components/ui/misc";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { getCategoryIcon } from "@/config/icons";
import type { SavingsGoalStatus } from "@/lib/types";
import { formatDayMonth } from "@/lib/utils/date";
import { formatRub, pluralize } from "@/lib/utils/format";

/**
 * Сводка по целям накоплений на странице расходов.
 *
 * Сам ввод пополнений и создание целей живут на отдельной странице
 * (/expenses/goals) — здесь только обзор прогресса, как у CategoryBudgets:
 * пусто задавать форму на две шапки ниже BudgetCard, если управлять целями
 * приходят редко, а смотреть на прогресс — часто.
 */

interface SavingsGoalsCardProps {
  goals: SavingsGoalStatus[];
  index?: number;
}

export function SavingsGoalsCard({ goals, index }: SavingsGoalsCardProps) {
  const activeCount = goals.filter((goal) => !goal.achieved).length;

  return (
    <Panel index={index}>
      <PanelHeader
        eyebrow="Накопления"
        title="Цели"
        description={
          goals.length === 0
            ? "Отложенное на цель — отдельно от дневного бюджета"
            : `${activeCount} ${pluralize(activeCount, "активная", "активные", "активных")}`
        }
        actions={
          <Link
            href="/expenses/goals"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-ink-muted transition-colors duration-200 hover:text-accent"
          >
            Все цели
            <ArrowUpRight size={14} />
          </Link>
        }
      />

      {goals.length === 0 ? (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-[12px] bg-surface-2 px-4 py-4">
          <p className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-muted">
            <PiggyBank size={15} className="mt-0.5 shrink-0" />
            Пока ни одной цели — «Новый ноутбук», «Поездка», что угодно со
            своей суммой и, если нужно, сроком.
          </p>
          <Link
            href="/expenses/goals"
            className="inline-flex h-10 cursor-pointer items-center rounded-[10px] bg-accent px-4 text-[13px] font-medium text-accent-ink transition-[filter] duration-200 hover:brightness-110"
          >
            Создать цель
          </Link>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {goals.map((goal) => {
            const Icon = getCategoryIcon(goal.icon);
            const barColor = goal.achieved ? "var(--positive)" : goal.color;
            const isOverdue = !goal.achieved && goal.daysLeft !== null && goal.daysLeft < 0;

            return (
              <li key={goal.goalId}>
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]"
                    style={{ backgroundColor: `${goal.color}1f`, color: goal.color }}
                    aria-hidden
                  >
                    {goal.achieved ? <Check size={14} /> : <Icon size={14} />}
                  </span>

                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                    {goal.name}
                  </span>

                  <span className="tabular shrink-0 text-[12px] text-ink-muted">
                    {formatRub(goal.saved, 0)} из {formatRub(goal.targetAmount, 0)}
                  </span>
                </div>

                <ShareBar value={goal.percent} color={barColor} className="mt-2" />

                <p
                  className={`mt-1 text-[11px] ${isOverdue ? "text-negative" : "text-ink-faint"}`}
                >
                  {goal.achieved
                    ? "Цель достигнута"
                    : isOverdue
                      ? `Срок был ${formatDayMonth(goal.targetDate ?? "")}`
                      : goal.suggestedMonthly !== null
                        ? `${formatRub(goal.suggestedMonthly, 0)}/мес, чтобы успеть к ${formatDayMonth(goal.targetDate ?? "")}`
                        : `Осталось ${formatRub(goal.remaining, 0)}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
