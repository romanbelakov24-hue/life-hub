"use client";

import type { ReactNode } from "react";

import { formatRub } from "@/lib/utils/format";

/**
 * Общий тултип для всех графиков раздела расходов.
 *
 * Recharts по умолчанию рисует белую подложку с инлайновыми стилями, которая
 * не переживает смену темы. Здесь подложка построена на токенах интерфейса,
 * поэтому выглядит одинаково уместно и на бумаге, и в тёмной теме.
 */

interface TooltipEntry {
  name?: ReactNode;
  value?: number | string;
  color?: string;
  /** Исходный объект точки данных — из него берём ключ периода. */
  payload?: Record<string, unknown>;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  /** Значение оси X, которое подставляет Recharts. */
  label?: ReactNode;
  /**
   * Преобразует `key` точки данных в заголовок тултипа.
   * Нужен там, где подпись оси сокращена (номер дня) — в тултипе хочется
   * видеть полную дату.
   */
  formatKey?: (key: string) => string;
}

export function ChartTooltip({ active, payload, label, formatKey }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const entry = payload[0];
  const value = typeof entry?.value === "number" ? entry.value : Number(entry?.value ?? 0);

  const pointKey = entry?.payload?.key;
  const title =
    formatKey && typeof pointKey === "string"
      ? formatKey(pointKey)
      : (label ?? entry?.name ?? "");

  return (
    <div className="rounded-[10px] border border-line bg-surface px-2.5 py-2 shadow-[0_4px_16px_rgb(0_0_0/0.12)]">
      <p className="text-[11px] text-ink-muted">{title}</p>
      <p className="tabular mt-0.5 text-sm font-semibold text-ink">{formatRub(value)}</p>
    </div>
  );
}
