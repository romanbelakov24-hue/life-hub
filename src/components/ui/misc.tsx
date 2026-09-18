import { Bot, Send, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { CountUp, type CountFormat } from "@/components/ui/count-up";
import type { RecordSource } from "@/lib/types";
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

// ─── Кольцо-индикатор доли ────────────────────────────────────────────────────

interface ProgressRingProps {
  /** Доля 0…100 (значения выше 100 рисуются как полное кольцо). */
  value: number;
  color: string;
  /** Диаметр в px. */
  size?: number;
  strokeWidth?: number;
  className?: string;
  children?: ReactNode;
}

/**
 * Кольцевой аналог ShareBar — там же, где важнее один крупный акцент, чем
 * ряд полос (герой виджета, а не список категорий).
 *
 * Заполнение анимируется от нуля через .animate-ring в globals.css: значение
 * приходит с сервера уже готовым, а рисуется оно от пустого кольца при
 * появлении — тот же приём, что у ShareBar/.animate-grow, просто по дуге.
 */
export function ProgressRing({
  value,
  color,
  size = 84,
  strokeWidth = 8,
  className,
  children,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, value));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className={cn("relative inline-flex shrink-0 items-center justify-center", className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={strokeWidth}
        />
        <circle
          className="animate-ring"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={
            {
              "--circumference": circumference,
              "--offset": offset,
            } as React.CSSProperties
          }
        />
      </svg>

      {children ? <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div> : null}
    </div>
  );
}

// ─── Крупная цифра метрики ───────────────────────────────────────────────────

interface MetricBaseProps {
  label: string;
  /** Дополнение справа от значения: тренд, единица измерения. */
  suffix?: ReactNode;
  /** Пояснение под значением. */
  caption?: string;
  /** Выделяет главную метрику блока. */
  emphasis?: boolean;
  className?: string;
}

/**
 * Значение задаётся ровно одним из двух способов: готовой строкой либо числом
 * с ключом формата — тогда оно анимируется. Union не даёт передать оба сразу
 * и забыть, какое из них выиграет.
 */
type MetricProps = MetricBaseProps &
  (
    | { value: string; count?: never }
    | { value?: never; count: { value: number; format: CountFormat } }
  );

export function Metric({
  label,
  value,
  count,
  suffix,
  caption,
  emphasis = false,
  className,
}: MetricProps) {
  const valueClasses = cn(
    "tabular font-semibold tracking-[-0.035em] text-ink",
    emphasis ? "text-[28px] leading-none sm:text-[34px]" : "text-xl leading-none",
  );

  return (
    <div className={cn("min-w-0", className)}>
      <p className="eyebrow">{label}</p>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {count ? (
          <CountUp value={count.value} format={count.format} className={valueClasses} />
        ) : (
          <span className={valueClasses}>{value}</span>
        )}
        {suffix}
      </div>

      {caption ? <p className="mt-1.5 text-[12px] text-ink-muted">{caption}</p> : null}
    </div>
  );
}

// ─── Откуда запись ───────────────────────────────────────────────────────────

interface SourceBadgeProps {
  source?: RecordSource;
  /** На цветной плашке (блок дела в календаре) — белый значок без подложки. */
  onColor?: boolean;
  className?: string;
}

/**
 * Значок у записей, пришедших не из интерфейса: самолётик — из Telegram-бота,
 * робот — от личного агента по API. Записи из приложения значка не получают:
 * их большинство, и метка на каждой была бы шумом.
 */
export function SourceBadge({ source, onColor = false, className }: SourceBadgeProps) {
  if (!source || source === "app") return null;
  const Icon = source === "telegram" ? Send : Bot;
  const label = source === "telegram" ? "Записано через Telegram" : "Записано агентом";

  return (
    <span
      title={label}
      aria-label={label}
      role="img"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full align-[-2px]",
        onColor ? "h-3 w-3 text-white/90" : "h-4 w-4 bg-accent-soft text-accent",
        className,
      )}
    >
      <Icon size={onColor ? 10 : 9} strokeWidth={2.5} />
    </span>
  );
}
