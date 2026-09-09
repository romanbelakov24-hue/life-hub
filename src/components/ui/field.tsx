"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";
import { useId } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Поля ввода.
 *
 * Правила, которых придерживаемся во всех формах проекта:
 *  • у поля всегда видимая подпись (плейсхолдер её не заменяет — он исчезает
 *    при вводе, и пользователь забывает, что именно вводит);
 *  • подсказка и ошибка стоят рядом с полем, а не общим списком сверху;
 *  • высота 44px — цель касания на телефоне.
 */

const CONTROL_BASE = cn(
  "glass-recessed w-full rounded-[10px] border border-line bg-surface-2 px-3 text-sm text-ink",
  "placeholder:text-ink-faint",
  "transition-[border-color,background-color] duration-200",
  "hover:border-line-strong",
  "focus:border-accent focus:bg-surface focus:outline-none",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

interface FieldShellProps {
  label: string;
  /** Скрывает подпись визуально, оставляя её для скринридеров. */
  hideLabel?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: (id: string) => ReactNode;
}

/** Обёртка «подпись + контрол + подсказка/ошибка». */
export function Field({
  label,
  hideLabel = false,
  hint,
  error,
  className,
  children,
}: FieldShellProps) {
  const id = useId();

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={id}
        className={cn(
          "text-[12px] font-medium text-ink-muted",
          hideLabel && "sr-only",
        )}
      >
        {label}
      </label>

      {children(id)}

      {error ? (
        <p className="text-[12px] text-negative" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12px] text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({
  className,
  ...props
}: ComponentPropsWithRef<"input">) {
  return <input className={cn(CONTROL_BASE, "h-11", className)} {...props} />;
}

/** Инпут для сумм: моноширинный, чтобы цифры не «плясали» при вводе. */
export function AmountInput({
  className,
  ...props
}: ComponentPropsWithRef<"input">) {
  return (
    <input
      inputMode="decimal"
      className={cn(CONTROL_BASE, "tabular h-11 text-right", className)}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: ComponentPropsWithRef<"textarea">) {
  return (
    <textarea className={cn(CONTROL_BASE, "min-h-24 resize-y py-2.5", className)} {...props} />
  );
}

export function Select({
  className,
  children,
  ...props
}: ComponentPropsWithRef<"select">) {
  return (
    <select className={cn(CONTROL_BASE, "h-11 cursor-pointer pr-8", className)} {...props}>
      {children}
    </select>
  );
}
