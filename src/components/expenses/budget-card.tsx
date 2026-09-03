import { ArrowUpRight, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";

import { Metric, ShareBar } from "@/components/ui/misc";
import { Panel, PanelHeader } from "@/components/ui/panel";
import type { BudgetForecast } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { formatRub, pluralize } from "@/lib/utils/format";

/**
 * Прогноз бюджета на остаток месяца.
 *
 * Главная цифра — сколько можно тратить в день. Всё остальное объясняет, откуда
 * она взялась, и предупреждает, если при нынешнем темпе денег не хватит.
 *
 * Без занесённого дохода считать нечего, поэтому вместо пустых нулей блок
 * предлагает внести доход — это единственное осмысленное действие в такой
 * ситуации.
 */

interface BudgetCardProps {
  forecast: BudgetForecast;
  index?: number;
}

export function BudgetCard({ forecast, index }: BudgetCardProps) {
  const hasIncome = forecast.income > 0;

  // Доля дохода, которую уже потратили. Больше 100% — ушли в минус.
  const spentShare =
    hasIncome ? Math.min((forecast.spent / forecast.income) * 100, 100) : 0;
  const isOverspent = forecast.remaining < 0;

  return (
    <Panel index={index}>
      <PanelHeader
        eyebrow="Бюджет"
        title="Сколько можно в день"
        description={
          forecast.daysLeft > 0
            ? `Осталось ${forecast.daysLeft} ${pluralize(forecast.daysLeft, "день", "дня", "дней")} до конца месяца`
            : "Месяц закрыт"
        }
        actions={
          <Link
            href="/expenses/income"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-ink-muted transition-colors duration-200 hover:text-accent"
          >
            Доходы
            <ArrowUpRight size={14} />
          </Link>
        }
      />

      {!hasIncome ? (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-[12px] bg-surface-2 px-4 py-4">
          <p className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-muted">
            <Wallet size={15} className="mt-0.5 shrink-0" />
            Доход за этот месяц не занесён — считать дневной лимит не из чего.
          </p>
          <Link
            href="/expenses/income"
            className="inline-flex h-10 cursor-pointer items-center rounded-[10px] bg-accent px-4 text-[13px] font-medium text-accent-ink transition-[filter] duration-200 hover:brightness-110"
          >
            Внести доход
          </Link>
        </div>
      ) : (
        <>
          {/* Главная цифра */}
          <div className="mt-4">
            <Metric
              label={isOverspent ? "Перерасход" : "Можно в день"}
              count={{
                value: isOverspent
                  ? Math.abs(forecast.remaining)
                  : (forecast.dailyAllowance ?? 0),
                format: "rub",
              }}
              emphasis
              caption={
                isOverspent
                  ? "Потрачено больше, чем пришло за месяц"
                  : `Из ${formatRub(forecast.remaining, 0)} остатка`
              }
            />
          </div>

          {/* Доход и траты */}
          <div className="mt-5">
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-ink-muted">
                Потрачено {formatRub(forecast.spent, 0)}
              </span>
              <span className="tabular text-ink-faint">
                из {formatRub(forecast.income, 0)}
              </span>
            </div>
            <ShareBar
              value={spentShare}
              color={isOverspent ? "var(--negative)" : "var(--accent)"}
              className="mt-2"
            />
          </div>

          {/* Темп и прогноз */}
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
            <Metric
              label="Тратите в день"
              value={formatRub(forecast.currentDailyRate, 0)}
              caption={
                forecast.historicalDailyRate === null
                  ? "в этом месяце"
                  : `раньше — ${formatRub(forecast.historicalDailyRate, 0)}`
              }
            />

            <Metric
              label="Выйдет за месяц"
              value={formatRub(forecast.projectedTotal, 0)}
              caption="при нынешнем темпе"
            />
          </div>

          {forecast.projectedBalance !== null && forecast.daysLeft > 0 ? (
            <p
              className={cn(
                "mt-4 flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[12px] leading-relaxed",
                forecast.projectedBalance < 0
                  ? "bg-negative-soft text-negative"
                  : "bg-positive-soft text-positive",
              )}
            >
              {forecast.projectedBalance < 0 ? (
                <TrendingUp size={14} className="mt-0.5 shrink-0" />
              ) : (
                <TrendingDown size={14} className="mt-0.5 shrink-0" />
              )}
              {forecast.projectedBalance < 0
                ? `При таком темпе не хватит ${formatRub(Math.abs(forecast.projectedBalance), 0)}. Чтобы уложиться, тратьте не больше ${formatRub(forecast.dailyAllowance ?? 0, 0)} в день.`
                : `Уложитесь и останется около ${formatRub(forecast.projectedBalance, 0)}.`}
            </p>
          ) : null}
        </>
      )}
    </Panel>
  );
}
