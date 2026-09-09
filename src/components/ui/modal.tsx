"use client";

import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * Модальное окно для форм создания и редактирования.
 *
 * Реализовано вручную (без библиотек), потому что нужно всего три вещи:
 * закрытие по Escape, блокировка прокрутки фона и на телефоне — «шторка»
 * снизу вместо центрированного окна, до которой дотягивается большой палец.
 *
 * Разметка выносится порталом в <body>. Это не украшательство: любой предок с
 * transform, filter или backdrop-filter становится точкой отсчёта для
 * position: fixed, и окно перестаёт быть на весь экран — оно запирается внутри
 * этого предка. Именно так ломалось окно категорий: строка кнопок в шапке
 * анимируется через transform, и окно оказывалось зажатым в ней.
 *
 * Портал решает это для всех модалок разом и на будущее: сколько бы анимаций
 * и размытий ни появилось в интерфейсе, до <body> они не дотянутся.
 */

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Кнопки внизу окна. */
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, description, children, footer }: ModalProps) {
  // Портал нельзя строить на сервере: document там нет. Поэтому до
  // монтирования компонент ничего не рисует.
  const [isMounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Escape закрывает окно; фон не прокручивается, пока окно открыто.
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !isMounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Затемнение: клик по фону закрывает окно. */}
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="animate-fade absolute inset-0 cursor-default bg-black/50 backdrop-blur-[3px]"
      />

      <div
        className={cn(
          // .glass отвечает за всю тень целиком (фаска + отрыв от фона) — свой
          // shadow-[...] тут не добавляем: и Tailwind, и .glass пишут в один и
          // тот же box-shadow, а слой utilities Tailwind в этой схлопке победил
          // бы безоговорочно и стёр бы фаску .glass.
          "glass animate-scale-in relative z-10 flex max-h-[92vh] w-full flex-col",
          "border border-line bg-surface",
          "rounded-t-[18px] sm:max-w-lg sm:rounded-[16px]",
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-[-0.015em] text-ink">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-[12px] text-ink-muted">{description}</p>
            ) : null}
          </div>

          <IconButton label="Закрыть" onClick={onClose} compact>
            <X size={18} />
          </IconButton>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>

        {footer ? (
          <footer className="flex justify-end gap-2 border-t border-line px-4 py-3 pb-safe sm:px-5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
