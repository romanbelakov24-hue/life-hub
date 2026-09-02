"use client";

import { PieChart as PieChartIcon } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { CategoryBreakdownList } from "@/components/expenses/category-breakdown-list";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { EmptyState } from "@/components/ui/misc";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { useChartTheme } from "@/components/charts/use-chart-theme";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import type { CategoryWithItems } from "@/lib/analytics/expenses";
import type { IsoDate } from "@/lib/types";
import { formatRub, pluralize } from "@/lib/utils/format";

/**
 * Расходы по категориям: донат + список с долями.
 *
 * Список рядом с диаграммой — не украшение: по цвету сектора трудно назвать
 * точную сумму, а по кольцу — сравнить близкие категории. Цвет здесь
 * вспомогательный, вся информация продублирована текстом.
 */

interface CategoryDonutProps {
  /** Категории с покупками: диаграмма берёт суммы, список — сами покупки. */
  breakdown: CategoryWithItems[];
  total: number;
  /** Сегодняшняя дата — для подписей дат в раскрытом списке. */
  today: IsoDate;
  /** Порядковый номер в сетке — задаёт задержку появления. */
  index?: number;
}

export function CategoryDonut({ breakdown, total, today, index }: CategoryDonutProps) {
  const theme = useChartTheme();
  const reducedMotion = useReducedMotion();

  return (
    <Panel className="flex flex-col" index={index}>
      <PanelHeader
        eyebrow="Структура"
        title="По категориям"
        description={
          total > 0
            ? `${breakdown.length} ${pluralize(breakdown.length, "категория", "категории", "категорий")} за месяц`
            : undefined
        }
      />

      {total === 0 ? (
        <EmptyState
          icon={PieChartIcon}
          title="Нет данных за месяц"
          description="Как только появятся траты, здесь будет разбивка по категориям."
        />
      ) : (
        // items-start, а не center: список раскрывается по клику, и
        // центрирование заставляло бы кольцо прыгать по вертикали.
        <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="relative mx-auto h-[190px] w-[190px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={breakdown}
                  dataKey="total"
                  nameKey="name"
                  innerRadius="64%"
                  outerRadius="100%"
                  paddingAngle={2}
                  strokeWidth={2}
                  stroke={theme.surface}
                  // Кольцо разворачивается по кругу — видно, как складываются доли.
                  isAnimationActive={!reducedMotion}
                  animationDuration={900}
                  animationEasing="ease-out"
                >
                  {breakdown.map((item) => (
                    <Cell key={item.categoryId} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Итог в центре кольца — главная цифра блока. */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="eyebrow">всего</span>
              <span className="tabular mt-1 text-lg font-semibold tracking-[-0.03em] text-ink">
                {formatRub(total, 0)}
              </span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <CategoryBreakdownList categories={breakdown} today={today} />
          </div>
        </div>
      )}
    </Panel>
  );
}
