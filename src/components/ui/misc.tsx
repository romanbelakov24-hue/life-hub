import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import { withAlpha } from "@/config/palette";

/** Мелкие переиспользуемые примитивы интерфейса. */

// ─── Пустое состояние ────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Кнопка действия — «добавить первую запись» и т.п. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface-2 text-ink-faint">
        <Icon size={20} />
      </span>

      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description ? (
          <p className="mt-1 max-w-xs text-[13px] leading-snug text-ink-muted">{description}</p>
        ) : null}
      </div>

      {action}
    </div>
  );
}

// ─── Цветная метка категории / предмета ──────────────────────────────────────

interface ColorTagProps {
  color: string;
  children: ReactNode;
  icon?: LucideIcon;
  className?: string;
}

export function ColorTag({ color, children, icon: Icon, className }: ColorTagProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5",
        "text-[12px] font-medium",
        className,
      )}
      style={{
        color,
        borderColor: withAlpha(color, 0.35),
        backgroundColor: withAlpha(color, 0.1),
      }}
    >
      {Icon ? <Icon size={12} className="shrink-0" /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

// ─── Индикатор тренда ────────────────────────────────────────────────────────

interface TrendPillProps {
  /** Изменение в процентах; null — сравнивать не с чем. */
  percent: number | null;
  /**
   * Для расходов рост — это плохо, поэтому положительное значение красится
   * в «негативный» цвет. Для метрик, где рост хорош, передай invert={false}.
   */
  invert?: boolean;
  children?: ReactNode;
}

export function TrendPill({ percent, invert = true, children }: TrendPillProps) {
  if (percent === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-faint">
        нет данных
      </span>
    );
  }

  const isGrowth = percent > 0;
  const isBad = invert ? isGrowth : !isGrowth;
  const isFlat = Math.abs(percent) < 0.05;

  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        isFlat
          ? "bg-surface-2 text-ink-muted"
          : isBad
            ? "bg-negative-soft text-negative"
            : "bg-positive-soft text-positive",
      )}
    >
      {children}
    </span>
  );
}

// ─── Полоса-индикатор доли ───────────────────────────────────────────────────

interface ShareBarProps {
  /** Доля 0…100. */
  value: number;
  color: string;
  className?: string;
}

export function ShareBar({ value, color, className }: ShareBarProps) {
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}
      role="presentation"
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ─── Крупная цифра метрики ───────────────────────────────────────────────────

interface MetricProps {
  label: string;
  value: string;
  /** Дополнение справа от значения: тренд, единица измерения. */
  suffix?: ReactNode;
  /** Пояснение под значением. */
  caption?: string;
  /** Выделяет главную метрику блока. */
  emphasis?: boolean;
  className?: string;
}

export function Metric({
  label,
  value,
  suffix,
  caption,
  emphasis = false,
  className,
}: MetricProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="eyebrow">{label}</p>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={cn(
            "tabular font-semibold tracking-[-0.035em] text-ink",
            emphasis ? "text-[28px] leading-none sm:text-[34px]" : "text-xl leading-none",
          )}
        >
          {value}
        </span>
        {suffix}
      </div>

      {caption ? <p className="mt-1.5 text-[12px] text-ink-muted">{caption}</p> : null}
    </div>
  );
}
