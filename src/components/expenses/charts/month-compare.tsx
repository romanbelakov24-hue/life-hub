"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { useChartTheme } from "@/components/charts/use-chart-theme";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { Panel, PanelHeader } from "@/components/ui/panel";
import type { TrendPoint } from "@/lib/types";
import { formatCompact } from "@/lib/utils/format";

/**
 * Сравнение месяцев.
 *
 * Выбранный месяц красится акцентом, остальные — приглушённой линией: глаз
 * находит «свой» столбец без чтения подписей и сразу видит, выше он или ниже
 * соседних.
 */

interface MonthCompareProps {
  months: TrendPoint[];
  /** Ключ выбранного месяца, например `2026-09`. */
  activeMonthKey: string;
  /** Порядковый номер в сетке — задаёт задержку появления. */
  index?: number;
}

export function MonthCompare({ months, activeMonthKey, index }: MonthCompareProps) {
  const theme = useChartTheme();
  const reducedMotion = useReducedMotion();
  const hasData = months.length > 0;

  return (
    <Panel index={index}>
      <PanelHeader
        eyebrow="Сравнение"
        title="Месяц к месяцу"
        description={hasData ? "Последние месяцы с тратами" : undefined}
      />

      <div className="mt-4 h-[190px] w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: theme.inkFaint }}
                tickLine={false}
                axisLine={{ stroke: theme.line }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: theme.inkFaint }}
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={formatCompact}
              />
              <Tooltip cursor={{ fill: theme.line, opacity: 0.4 }} content={<ChartTooltip />} />
              <Bar
                dataKey="total"
                radius={[4, 4, 0, 0]}
                isAnimationActive={!reducedMotion}
                animationDuration={700}
                animationEasing="ease-out"
              >
                {months.map((month) => (
                  <Cell
                    key={month.key}
                    fill={month.key === activeMonthKey ? theme.accent : theme.line}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-[10px] border border-dashed border-line text-[13px] text-ink-faint">
            Нужны данные хотя бы за один месяц
          </div>
        )}
      </div>
    </Panel>
  );
}
