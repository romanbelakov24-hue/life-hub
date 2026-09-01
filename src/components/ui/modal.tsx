"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * Модальное окно для форм создания и редактирования.
 *
 * Реализовано вручную (без библиотек), потому что нужно всего три вещи:
 * закрытие по Escape, блокировка прокрутки фона и на телефоне — «шторка»
 * снизу вместо центрированного окна, до которой дотягивается большой палец.
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

  if (!open) return null;

  return (
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
        className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-[2px]"
      />

      <div
        className={cn(
          "relative z-10 flex max-h-[92vh] w-full flex-col border border-line bg-surface",
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
    </div>
  );
}
