import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Кнопки приложения.
 *
 * Размеры подобраны под палец: базовая высота 44px — минимальная цель касания
 * по мобильным гайдлайнам. `sm` (36px) допустим только там, где кнопки не стоят
 * вплотную друг к другу.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-ink hover:brightness-110 active:brightness-95 border border-transparent",
  secondary:
    "bg-surface-2 text-ink hover:bg-surface-3 border border-line active:bg-surface-3",
  outline:
    "bg-transparent text-ink hover:bg-surface-2 border border-line-strong",
  ghost:
    "bg-transparent text-ink-muted hover:bg-surface-2 hover:text-ink border border-transparent",
  danger:
    "bg-transparent text-negative hover:bg-negative-soft border border-transparent",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-9 px-3 text-[13px] gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-[10px] font-medium",
        "transition-[background-color,color,filter,border-color] duration-200",
        "disabled:cursor-not-allowed disabled:opacity-45",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Обязателен: кнопка без текста должна быть озвучена скринридером. */
  label: string;
  children: ReactNode;
  /** Компактный вариант (40px) для плотных строк таблицы. */
  compact?: boolean;
}

export function IconButton({
  variant = "ghost",
  label,
  compact = false,
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[10px]",
        "transition-[background-color,color,filter,border-color] duration-200",
        "disabled:cursor-not-allowed disabled:opacity-45",
        compact ? "h-10 w-10" : "h-11 w-11",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
