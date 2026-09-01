"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { useChartTheme } from "@/components/charts/use-chart-theme";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { dailyTrendTooltipLabel } from "@/lib/analytics/expenses";
import type { IsoDate, TrendPoint } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { formatWeekKey } from "@/lib/utils/date";
import { formatCompact } from "@/lib/utils/format";

/**
 * Динамика трат: столбцы по дням или линия по неделям.
 *
 * Два представления одних данных решают разные задачи: по дням видно
 * всплески (что-то дорогое куплено 12-го), по неделям — общий тренд без шума.
 * Пунктир — средние траты за день: сразу понятно, какие дни выбиваются.
 */

type Granularity = "day" | "week";

const GRANULARITY_OPTIONS = [
  { value: "day", label: "Дни" },
  { value: "week", label: "Недели" },
] as const;

interface SpendingTrendProps {
  daily: TrendPoint[];
  weekly: TrendPoint[];
  /** Сегодняшняя дата — её столбец выделяется цветом текста. */
  today: IsoDate;
}

export function SpendingTrend({ daily, weekly, today }: SpendingTrendProps) {
  const [granularity, setGranularity] = useState<Granularity>("day");
  const theme = useChartTheme();

  const isDaily = granularity === "day";
  const data = isDaily ? daily : weekly;
  const hasData = data.some((point) => point.total > 0);

  // Среднее считаем только по дням с тратами: нули занижают ориентир.
  const average = useMemo(() => {
    const spentPoints = data.filter((point) => point.total > 0);
    if (spentPoints.length === 0) return 0;
    return spentPoints.reduce((sum, point) => sum + point.total, 0) / spentPoints.length;
  }, [data]);

  const axisStyle = { fontSize: 10, fill: theme.inkFaint };

  return (
    <Panel>
      <PanelHeader
        eyebrow="Динамика"
        title={isDaily ? "Траты по дням" : "Траты по неделям"}
        description={
          hasData
            ? `Пунктир — среднее по периодам с тратами`
            : undefined
        }
        actions={
          <div
            role="tablist"
            aria-label="Детализация графика"
            className="inline-flex rounded-full border border-line bg-surface-2 p-0.5"
          >
            {GRANULARITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={granularity === option.value}
                onClick={() => setGranularity(option.value)}
                className={cn(
                  "cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors duration-200",
                  granularity === option.value
                    ? "bg-surface text-ink"
                    : "text-ink-faint hover:text-ink",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="mt-4 h-[210px] w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            {isDaily ? (
              <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <CartesianGrid stroke={theme.line} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={axisStyle}
                  tickLine={false}
                  axisLine={{ stroke: theme.line }}
                  interval="preserveStartEnd"
                  minTickGap={10}
                />
                <YAxis
                  tick={axisStyle}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={formatCompact}
                />
                <Tooltip
                  cursor={{ fill: theme.line, opacity: 0.4 }}
                  content={<ChartTooltip formatKey={dailyTrendTooltipLabel} />}
                />
                <ReferenceLine
                  y={average}
                  stroke={theme.inkFaint}
                  strokeDasharray="3 4"
                  strokeWidth={1}
                />
                <Bar dataKey="total" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  {data.map((point) => (
                    <Cell
                      key={point.key}
                      // Сегодняшний столбец красим цветом текста — он читается
                      // как «текущая позиция», а не как ещё одна категория.
                      fill={point.key === today ? theme.ink : theme.accent}
                    />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke={theme.line} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={axisStyle}
                  tickLine={false}
                  axisLine={{ stroke: theme.line }}
                />
                <YAxis
                  tick={axisStyle}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={formatCompact}
                />
                <Tooltip
                  cursor={{ stroke: theme.line }}
                  content={<ChartTooltip formatKey={formatWeekKey} />}
                />
                <ReferenceLine
                  y={average}
                  stroke={theme.inkFaint}
                  strokeDasharray="3 4"
                  strokeWidth={1}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke={theme.accent}
                  strokeWidth={2}
                  dot={{ r: 3, fill: theme.accent, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-[10px] border border-dashed border-line text-[13px] text-ink-faint">
            За этот месяц трат ещё нет
          </div>
        )}
      </div>
    </Panel>
  );
}
