import { ArrowUpRight, Wallet } from "lucide-react";
import Link from "next/link";

import { Metric, ShareBar } from "@/components/ui/misc";
import { Panel, PanelHeader } from "@/components/ui/panel";
import type { CategoryBreakdownItem, ExpenseWithCategory } from "@/lib/types";
import { formatDayMonthShort } from "@/lib/utils/date";
import { formatNumber, formatRub } from "@/lib/utils/format";

/**
 * Виджет расходов на «Обзоре»: сколько потрачено сегодня и за месяц,
 * три самые затратные категории и последние записи.
 */

interface MoneyCardProps {
  todayTotal: number;
  monthTotal: number;
  monthTitle: string;
  breakdown: CategoryBreakdownItem[];
  recentExpenses: ExpenseWithCategory[];
}

export function MoneyCard({
  todayTotal,
  monthTotal,
  monthTitle,
  breakdown,
  recentExpenses,
}: MoneyCardProps) {
  const topCategories = breakdown.slice(0, 3);

  return (
    <Panel className="flex flex-col">
      <PanelHeader
        eyebrow="Финансы"
        title="Расходы"
        actions={
          <Link
            href="/expenses"
            className="flex h-9 cursor-pointer items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-ink-muted transition-colors duration-200 hover:text-accent"
          >
            Открыть
            <ArrowUpRight size={14} />
          </Link>
        }
      />

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Metric label="Сегодня" value={formatRub(todayTotal, 0)} emphasis />
        <Metric label="За месяц" value={formatRub(monthTotal, 0)} caption={monthTitle} />
      </div>

      {topCategories.length > 0 ? (
        <ul className="mt-5 flex flex-col gap-2.5">
          {topCategories.map((item) => (
            <li key={item.categoryId}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] text-ink">{item.name}</span>
                <span className="tabular shrink-0 text-[12px] text-ink-muted">
                  {formatRub(item.total, 0)}
                  <span className="ml-1.5 text-ink-faint">{formatNumber(item.share, 0)}%</span>
                </span>
              </div>
              <ShareBar value={item.share} color={item.color} className="mt-1.5" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 flex items-center gap-2 rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12px] text-ink-muted">
          <Wallet size={14} className="shrink-0" />
          В этом месяце трат ещё не было.
        </p>
      )}

      {recentExpenses.length > 0 ? (
        <div className="mt-5 border-t border-line pt-3.5">
          <p className="eyebrow mb-2.5">Последние записи</p>

          <ul className="flex flex-col gap-1.5">
            {recentExpenses.map((expense) => (
              <li key={expense.id} className="flex items-baseline justify-between gap-2">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span
                    className="h-1.5 w-1.5 shrink-0 translate-y-px rounded-full"
                    style={{ backgroundColor: expense.categoryColor }}
                    aria-hidden
                  />
                  <span className="truncate text-[13px] text-ink">
                    {expense.note || expense.categoryName}
                  </span>
                </span>

                <span className="tabular shrink-0 text-[12px] text-ink-muted">
                  {formatRub(expense.amount, 0)}
                  <span className="ml-2 text-ink-faint">
                    {formatDayMonthShort(expense.date)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}
