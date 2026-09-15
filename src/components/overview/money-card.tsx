import { ArrowUpRight, Wallet } from "lucide-react";
import Link from "next/link";

import { Metric, ProgressRing, ShareBar } from "@/components/ui/misc";
import { Panel, PanelHeader } from "@/components/ui/panel";
import type { CategoryBreakdownItem, ExpenseWithCategory } from "@/lib/types";
import { formatDayMonthShort } from "@/lib/utils/date";
import { formatNumber, formatRub } from "@/lib/utils/format";

/**
 * Виджет расходов на «Обзоре»: сколько потрачено сегодня и за месяц,
 * три самые затратные категории и последние записи.
 *
 * Самая крупная категория — кольцом (см. ProgressRing), а не полосой: это
 * герой виджета, ему положен акцент покрупнее. Остальные — по-прежнему
 * ShareBar, кольца на каждую было бы уже избыточно. Последние траты — не
 * строки списка, а посадочные талоны (.pass-card): корешок цветом категории
 * + пунктирный отрыв, тот же язык, что у ближайших дел рядом на этой же
 * странице (см. TodayCard).
 */

interface MoneyCardProps {
  todayTotal: number;
  monthTotal: number;
  monthTitle: string;
  breakdown: CategoryBreakdownItem[];
  recentExpenses: ExpenseWithCategory[];
  /** Порядковый номер в сетке — задаёт задержку появления. */
  index?: number;
}

export function MoneyCard({
  todayTotal,
  monthTotal,
  monthTitle,
  breakdown,
  recentExpenses,
  index,
}: MoneyCardProps) {
  const topCategories = breakdown.slice(0, 3);
  const heroCategory = topCategories[0];
  const restCategories = topCategories.slice(1);

  return (
    <Panel className="flex flex-col" index={index}>
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
        <Metric label="Сегодня" count={{ value: todayTotal, format: "rub" }} emphasis />
        <Metric
          label="За месяц"
          count={{ value: monthTotal, format: "rub" }}
          caption={monthTitle}
        />
      </div>

      {heroCategory ? (
        <div className="mt-5 flex items-center gap-4 rounded-[16px] bg-surface-2/60 p-3">
          <div className="living-glow rounded-full" style={{ color: heroCategory.color }}>
            <ProgressRing value={heroCategory.share} color={heroCategory.color} size={72} strokeWidth={7}>
              <span className="tabular text-[15px] font-bold text-ink">
                {formatNumber(heroCategory.share, 0)}%
              </span>
            </ProgressRing>
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-ink">{heroCategory.name}</p>
            <p className="tabular mt-0.5 text-[12px] text-ink-muted">
              {formatRub(heroCategory.total, 0)} — больше всего в этом месяце
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-5 flex items-center gap-2 rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12px] text-ink-muted">
          <Wallet size={14} className="shrink-0" />
          В этом месяце трат ещё не было.
        </p>
      )}

      {restCategories.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2.5">
          {restCategories.map((item) => (
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
      ) : null}

      {recentExpenses.length > 0 ? (
        <div className="mt-5 border-t border-line pt-3.5">
          <p className="eyebrow mb-2.5">Последние записи</p>

          <ul className="flex flex-col gap-1.5">
            {recentExpenses.map((expense) => (
              <li key={expense.id} className="pass-card bg-surface-2/70">
                <span className="pass-stub" style={{ backgroundColor: expense.categoryColor }} aria-hidden />
                <div className="pass-body flex min-w-0 flex-1 items-baseline justify-between gap-2 py-2 pl-3 pr-3">
                  <span className="truncate text-[13px] text-ink">
                    {expense.note || expense.categoryName}
                  </span>

                  <span className="tabular shrink-0 text-[12px] text-ink-muted">
                    {formatRub(expense.amount, 0)}
                    <span className="ml-2 text-ink-faint">
                      {formatDayMonthShort(expense.date)}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}
