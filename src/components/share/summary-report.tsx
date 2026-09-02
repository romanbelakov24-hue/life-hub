import { ArrowDownRight, ArrowUpRight, Minus, Wallet } from "lucide-react";

import { CategoryBreakdownList } from "@/components/expenses/category-breakdown-list";
import { CountUp } from "@/components/ui/count-up";
import type { CategoryWithItems } from "@/lib/analytics/expenses";
import type { IsoDate, TrendPoint } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { formatRub, formatSignedPercent, pluralize } from "@/lib/utils/format";

/**
 * Публичная сводка трат за месяц — то, чем можно поделиться с близкими.
 *
 * Осознанно НЕ показывает отдельные покупки: список «шаверма 780 ₽, кофе
 * 415 ₽» и есть тот самый кассовый чек, который читать неприятно и незачем.
 * Вместо него — крупная сумма, направление относительно прошлого месяца,
 * структура по категориям и ритм месяца. Этого достаточно, чтобы понять
 * картину, и не требует вчитываться в строки.
 *
 * Компонент серверный: анимации сделаны на CSS, а единственная клиентская
 * часть — счётчик суммы.
 */

interface SummaryReportProps {
  /** Название месяца в именительном падеже, например «Сентябрь». */
  monthName: string;
  year: number;
  total: number;
  /** Изменение к прошлому месяцу в процентах; null — сравнивать не с чем. */
  changePercent: number | null;
  /** Категории вместе с покупками — список раскрывается по клику. */
  categories: CategoryWithItems[];
  /** Траты по дням — из них строится «ритм месяца». */
  daily: TrendPoint[];
  /** Сегодняшняя дата — для подписей «Сегодня» / «Вчера» в покупках. */
  today: IsoDate;
  transactionCount: number;
  averagePerDay: number;
  /** Сколько дней месяца учтено. */
  daysElapsed: number;
}

export function SummaryReport({
  monthName,
  year,
  total,
  changePercent,
  categories,
  daily,
  today,
  transactionCount,
  averagePerDay,
  daysElapsed,
}: SummaryReportProps) {
  const isEmpty = total === 0;

  const maxDaily = Math.max(...daily.map((point) => point.total), 1);

  return (
    <div className="mx-auto w-full max-w-[620px] px-5 py-10 sm:py-16">
      {/* ─── Шапка ─────────────────────────────────────────────────────────── */}
      <header className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <span className="ghost-title animate-fade absolute -left-1 -top-4 text-[76px] opacity-25 sm:text-[110px] sm:opacity-35">
            {monthName}
          </span>
        </div>

        <div className="relative">
          <p className="eyebrow animate-fade">Траты за месяц</p>

          {/* Год намеренно мельче: «Сентябрь 2026» одним кеглем не помещается
              в 375px и растягивает страницу вбок. Заодно так читается лучше —
              месяц главный, год уточняющий. */}
          <h1 className="animate-rise mt-3 flex flex-wrap items-baseline gap-x-3 font-display text-[38px] font-bold leading-[0.95] tracking-[-0.04em] text-ink sm:text-[54px]">
            <span>{monthName}</span>
            <span className="tabular text-[22px] font-medium text-ink-faint sm:text-[30px]">
              {year}
            </span>
          </h1>
        </div>
      </header>

      {isEmpty ? (
        <EmptyMonth />
      ) : (
        <>
          {/* ─── Главная цифра ───────────────────────────────────────────── */}
          <section
            className="animate-rise stagger mt-8"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            <CountUp
              value={total}
              format="rub"
              className="tabular block text-[46px] font-semibold leading-none tracking-[-0.045em] text-ink text-glow sm:text-[64px]"
            />

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <TrendBadge percent={changePercent} />
              <span className="text-[13px] text-ink-muted">
                {transactionCount}{" "}
                {pluralize(transactionCount, "покупка", "покупки", "покупок")} за{" "}
                {daysElapsed} {pluralize(daysElapsed, "день", "дня", "дней")}
              </span>
            </div>
          </section>

          {/* ─── Ритм месяца ─────────────────────────────────────────────── */}
          <section
            className="animate-rise stagger mt-10"
            style={{ "--i": 2 } as React.CSSProperties}
          >
            <p className="eyebrow mb-3">Ритм месяца</p>

            <div className="flex h-16 items-end gap-[3px]" aria-hidden>
              {daily.map((point, index) => (
                <span
                  key={point.key}
                  className={cn(
                    "animate-grow-height flex-1 rounded-t-[2px]",
                    point.total > 0 ? "bg-accent/70" : "bg-line",
                  )}
                  style={
                    {
                      // Пустые дни оставляем видимой засечкой, иначе в ряду
                      // появляются дыры и месяц выглядит рваным.
                      height: point.total > 0 ? `${(point.total / maxDaily) * 100}%` : "3px",
                      animationDelay: `${Math.min(index, 30) * 18}ms`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>

            <p className="mt-2 text-[12px] text-ink-faint">
              В среднем {formatRub(averagePerDay, 0)} в день
            </p>
          </section>

          {/* ─── Структура ───────────────────────────────────────────────── */}
          <section
            className="animate-rise stagger mt-10"
            style={{ "--i": 3 } as React.CSSProperties}
          >
            <p className="eyebrow mb-1">Куда уходит</p>
            <p className="mb-4 text-[12px] text-ink-faint">
              Нажмите на категорию, чтобы увидеть покупки
            </p>

            <CategoryBreakdownList
              categories={categories}
              today={today}
              limit={5}
              variant="report"
            />
          </section>
        </>
      )}

      {/* ─── Подпись ───────────────────────────────────────────────────────── */}
      <footer
        className="animate-fade stagger mt-12 border-t border-line pt-5"
        style={{ "--i": 4 } as React.CSSProperties}
      >
        <p className="flex items-center gap-2 text-[12px] text-ink-faint">
          <Wallet size={13} />
          Сводка обновляется сама — страница всегда показывает текущий месяц
        </p>
      </footer>
    </div>
  );
}

/** Значок изменения к прошлому месяцу. */
function TrendBadge({ percent }: { percent: number | null }) {
  if (percent === null) {
    return (
      <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] text-ink-muted">
        первый месяц
      </span>
    );
  }

  const isFlat = Math.abs(percent) < 0.5;
  const isGrowth = percent > 0;
  const Icon = isFlat ? Minus : isGrowth ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium",
        isFlat
          ? "bg-surface-2 text-ink-muted"
          : isGrowth
            ? "bg-negative-soft text-negative"
            : "bg-positive-soft text-positive",
      )}
    >
      <Icon size={12} />
      {isFlat ? "как в прошлом месяце" : `${formatSignedPercent(percent)} к прошлому`}
    </span>
  );
}

function EmptyMonth() {
  return (
    <p className="animate-rise mt-8 rounded-[14px] border border-line bg-surface/85 px-5 py-8 text-center text-[14px] text-ink-muted backdrop-blur-xl">
      В этом месяце трат ещё нет.
    </p>
  );
}
