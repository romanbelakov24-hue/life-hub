import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import { Metric, TrendPill } from "@/components/ui/misc";
import type { PeriodTotals } from "@/lib/types";
import { formatSignedPercent } from "@/lib/utils/format";

/**
 * Итоги за день, неделю и месяц.
 *
 * «Сегодня» и «Неделя» всегда считаются от реальной текущей даты, а «Месяц» —
 * от выбранного в переключателе. Это осознанно: первые две цифры отвечают на
 * вопрос «сколько я уже потратил прямо сейчас», третья — на «каким получился
 * этот месяц».
 */

interface SummaryCardsProps {
  totals: PeriodTotals;
  /** Заголовок выбранного месяца — подпись под главной цифрой. */
  monthTitle: string;
  /** Показывать ли пометку, что месяц ещё не закончился. */
  isCurrentMonth: boolean;
}

export function SummaryCards({ totals, monthTitle, isCurrentMonth }: SummaryCardsProps) {
  const monthChange =
    totals.prevMonth > 0
      ? ((totals.month - totals.prevMonth) / totals.prevMonth) * 100
      : null;

  const TrendIcon =
    monthChange === null || Math.abs(monthChange) < 0.05
      ? ArrowRight
      : monthChange > 0
        ? ArrowUpRight
        : ArrowDownRight;

  return (
    <section className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-line bg-line sm:grid-cols-4">
      {/* Главная цифра занимает две колонки — она отвечает на основной вопрос. */}
      {/* Пятно на каждой ячейке отдельно: ячейки непрозрачные, и свечение,
          лежащее под ними на уровне секции, было бы не видно. */}
      <div data-spotlight className="spotlight relative col-span-2 bg-surface p-4 sm:p-5">
        <Metric
          label={isCurrentMonth ? "Месяц (идёт)" : "За месяц"}
          count={{ value: totals.month, format: "rub" }}
          emphasis
          caption={monthTitle}
          suffix={
            <TrendPill percent={monthChange}>
              <TrendIcon size={11} />
              {monthChange === null ? "" : formatSignedPercent(monthChange)}
            </TrendPill>
          }
        />
      </div>

      <div data-spotlight className="spotlight relative bg-surface p-4 sm:p-5">
        <Metric label="Сегодня" count={{ value: totals.today, format: "rub" }} />
      </div>

      <div data-spotlight className="spotlight relative bg-surface p-4 sm:p-5">
        <Metric
          label="Эта неделя"
          count={{ value: totals.week, format: "rub" }}
          caption="с понедельника"
        />
      </div>
    </section>
  );
}
