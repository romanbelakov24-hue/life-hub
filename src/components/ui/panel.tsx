import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Panel — базовый контейнер интерфейса.
 *
 * Стекло, а не плашка: помимо волосяной рамки — фаска (.glass, см.
 * globals.css) и мягкая тень отрыва от фона, вместе дающие панели объём.
 * Контраст текста при этом не страдает: сама фаска — это внутренние тени по
 * краю, они не ложатся на текст в середине панели.
 *
 * Фон намеренно полупрозрачный, да ещё и с поднятой насыщенностью цвета за
 * стеклом (.glass-blur): под интерфейсом дрейфуют цветные пятна (см.
 * AmbientGlow), и панель должна их пропускать сквозь себя приглушённо и
 * ярче, а не закрывать наглухо плоским затемнением. Так появляется
 * слоистость — сцена читается как настоящее стекло над светом, а не как
 * набор полупрозрачных плашек.
 *
 * По верхней кромке ещё и световой блик (edge-light) — отделяет панель от
 * фона там, где рамки почти не видно.
 */

interface PanelProps {
  children: ReactNode;
  className?: string;
  /** Убирает внутренние отступы — для таблиц во всю ширину панели. */
  flush?: boolean;
  /** Порядковый номер для каскадного появления в сетке. */
  index?: number;
}

export function Panel({ children, className, flush = false, index }: PanelProps) {
  return (
    <section
      className={cn(
        "glass glass-blur edge-light spotlight animate-rise relative rounded-[14px]",
        "border border-line bg-surface/88",
        index !== undefined && "stagger",
        // overflow-hidden только для flush-панелей: у панелей с графиками
        // он обрезал бы тултипы Recharts, вылезающие за край области.
        flush ? "overflow-hidden" : "p-4 sm:p-5",
        className,
      )}
      // Метка для PointerTracker: он ищет ближайшую панель через closest().
      data-spotlight
      style={index !== undefined ? ({ "--i": index } as React.CSSProperties) : undefined}
    >
      {children}
    </section>
  );
}

interface PanelHeaderProps {
  /** Микро-заголовок капслоком над названием секции. */
  eyebrow?: string;
  title: ReactNode;
  /** Пояснение под заголовком. */
  description?: ReactNode;
  /** Кнопки и переключатели справа. */
  actions?: ReactNode;
  className?: string;
}

export function PanelHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PanelHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h2 className="text-base font-semibold tracking-[-0.015em] text-ink sm:text-[17px]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-[13px] leading-snug text-ink-muted">{description}</p>
        ) : null}
      </div>

      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
