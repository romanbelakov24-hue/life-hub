"use client";

import { MoreHorizontal, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS, isNavItemActive } from "@/config/nav";
import { cn } from "@/lib/utils/cn";

/**
 * Нижний таб-бар для телефона.
 *
 * Почему снизу: приложение используется в основном с телефона, а нижняя треть
 * экрана — единственная зона, куда уверенно дотягивается большой палец.
 *
 * Ячеек ровно пять: четыре частых раздела и «Ещё». Шестой пункт в ряд уже не
 * помещается без потери размера цели касания, поэтому редкие разделы открываются
 * шторкой — она появляется у нижнего края, там же, где палец.
 */
export function MobileNav() {
  const pathname = usePathname();
  const [isSheetOpen, setSheetOpen] = useState(false);

  // Переход по ссылке должен закрывать шторку: иначе она остаётся висеть
  // поверх только что открытого раздела.
  useEffect(() => setSheetOpen(false), [pathname]);

  // Пока шторка открыта, фон не прокручивается.
  useEffect(() => {
    if (!isSheetOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheetOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isSheetOpen]);

  const isSecondaryActive = SECONDARY_NAV_ITEMS.some((item) =>
    isNavItemActive(item.href, pathname),
  );

  return (
    <>
      {isSheetOpen ? <MoreSheet onClose={() => setSheetOpen(false)} pathname={pathname} /> : null}

      <nav
        aria-label="Разделы"
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md",
          "pb-safe lg:hidden",
        )}
      >
        <ul className="flex items-stretch">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = isNavItemActive(item.href, pathname);

            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex h-14 flex-col items-center justify-center gap-1",
                    "transition-colors duration-200",
                    isActive ? "text-accent" : "text-ink-faint active:text-ink",
                  )}
                >
                  {/* Акцентная черта сверху вместо заливки — не съедает место. */}
                  <span
                    className={cn(
                      "absolute top-0 h-[2px] w-8 rounded-b-full bg-accent transition-opacity duration-200",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <Icon size={19} />
                  <span className="text-[10px] font-medium leading-none">
                    {item.shortLabel}
                  </span>
                </Link>
              </li>
            );
          })}

          <li className="flex-1">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-expanded={isSheetOpen}
              aria-haspopup="dialog"
              className={cn(
                "relative flex h-14 w-full cursor-pointer flex-col items-center justify-center gap-1",
                "transition-colors duration-200",
                isSecondaryActive ? "text-accent" : "text-ink-faint active:text-ink",
              )}
            >
              <span
                className={cn(
                  "absolute top-0 h-[2px] w-8 rounded-b-full bg-accent transition-opacity duration-200",
                  isSecondaryActive ? "opacity-100" : "opacity-0",
                )}
              />
              <MoreHorizontal size={19} />
              <span className="text-[10px] font-medium leading-none">Ещё</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}

/** Шторка с редкими разделами. */
function MoreSheet({ onClose, pathname }: { onClose: () => void; pathname: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="animate-fade absolute inset-0 cursor-default bg-black/50 backdrop-blur-[3px]"
      />

      <div className="animate-scale-in relative z-10 w-full rounded-t-[18px] border border-line bg-surface pb-safe">
        <header className="flex items-center justify-between border-b border-line px-4 py-3.5">
          <h2 className="text-base font-semibold tracking-[-0.015em] text-ink">Ещё</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] text-ink-muted"
          >
            <X size={18} />
          </button>
        </header>

        <ul className="flex flex-col p-2">
          {SECONDARY_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = isNavItemActive(item.href, pathname);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex h-14 items-center gap-3 rounded-[10px] px-3 text-sm",
                    "transition-colors duration-200",
                    isActive
                      ? "bg-accent-soft font-medium text-accent"
                      : "text-ink active:bg-surface-2",
                  )}
                >
                  <Icon size={19} className="shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}

          <li>
            <Link
              href="/settings"
              className={cn(
                "flex h-14 items-center gap-3 rounded-[10px] px-3 text-sm",
                "transition-colors duration-200",
                pathname === "/settings"
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-ink active:bg-surface-2",
              )}
            >
              <Settings size={19} className="shrink-0" />
              Настройки
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
