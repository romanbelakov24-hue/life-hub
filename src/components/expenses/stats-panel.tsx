import { ArrowDownRight, ArrowRight, ArrowUpRight, TrendingUp } from "lucide-react";

import { Metric, TrendPill } from "@/components/ui/misc";
import { Panel, PanelHeader } from "@/components/ui/panel";
import type { ExpenseStats } from "@/lib/types";
import { formatDayMonthShort } from "@/lib/utils/date";
import { formatNumber, formatRub, formatSignedPercent, pluralize } from "@/lib/utils/format";

/**
 * Сводная статистика месяца: средний чек, средний расход в день,
 * самая затратная категория, крупнейшая покупка и тренд к прошлому месяцу.
 */

interface StatsPanelProps {
  stats: ExpenseStats;
  /** Сколько дней месяца учтено в среднем за день — поясняем в подписи. */
  daysElapsed: number;
}

export function StatsPanel({ stats, daysElapsed }: StatsPanelProps) {
  const TrendIcon =
    stats.monthOverMonthPercent === null || Math.abs(stats.monthOverMonthPercent) < 0.05
      ? ArrowRight
      : stats.monthOverMonthPercent > 0
        ? ArrowUpRight
        : ArrowDownRight;

  return (
    <Panel>
      <PanelHeader eyebrow="Статистика" title="Как прошёл месяц" />

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
        <Metric
          label="Средний чек"
          value={formatRub(stats.averageCheck, 0)}
          caption={`${stats.transactionCount} ${pluralize(
            stats.transactionCount,
            "операция",
            "операции",
            "операций",
          )}`}
        />

        <Metric
          label="В день"
          value={formatRub(stats.averagePerDay, 0)}
          caption={`за ${daysElapsed} ${pluralize(daysElapsed, "день", "дня", "дней")}`}
        />

        <Metric
          label="К прошлому месяцу"
          value={
            stats.monthOverMonthPercent === null
              ? "—"
              : formatSignedPercent(stats.monthOverMonthPercent)
          }
          suffix={
            stats.monthOverMonthPercent === null ? null : (
              <TrendPill percent={stats.monthOverMonthPercent}>
                <TrendIcon size={11} />
              </TrendPill>
            )
          }
          caption={stats.monthOverMonthPercent === null ? "нет данных для сравнения" : undefined}
        />

        <div className="col-span-2 sm:col-span-3">
          <div className="h-px w-full bg-line" />
        </div>

        {/* Самая затратная категория — с полосой доли, чтобы был масштаб. */}
        <div className="col-span-2 min-w-0 sm:col-span-2">
          <p className="eyebrow">Самая затратная категория</p>

          {stats.topCategory ? (
            <div className="mt-2 flex items-center gap-2.5">
              <span
                className="h-8 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: stats.topCategory.color }}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {stats.topCategory.name}
                </p>
                <p className="tabular text-[12px] text-ink-muted">
                  {formatRub(stats.topCategory.total, 0)} ·{" "}
                  {formatNumber(stats.topCategory.share, 1)}% всех трат
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-faint">—</p>
          )}
        </div>

        <div className="col-span-2 min-w-0 sm:col-span-1">
          <p className="eyebrow">Крупнейшая трата</p>

          {stats.largestExpense ? (
            <div className="mt-2">
              <p className="tabular text-sm font-semibold text-ink">
                {formatRub(stats.largestExpense.amount, 0)}
              </p>
              <p className="truncate text-[12px] text-ink-muted">
                {stats.largestExpense.note || stats.largestExpense.categoryName} ·{" "}
                {formatDayMonthShort(stats.largestExpense.date)}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-faint">—</p>
          )}
        </div>
      </div>

      {stats.total === 0 ? (
        <p className="mt-5 flex items-center gap-2 rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12px] text-ink-muted">
          <TrendingUp size={14} className="shrink-0" />
          Статистика появится, как только будут первые траты за месяц.
        </p>
      ) : null}
    </Panel>
  );
}
