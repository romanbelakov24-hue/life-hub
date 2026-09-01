"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS, isNavItemActive } from "@/config/nav";
import { cn } from "@/lib/utils/cn";

/**
 * Нижний таб-бар для телефона.
 *
 * Почему снизу: приложение используется в основном с телефона, а нижняя треть
 * экрана — единственная зона, куда уверенно дотягивается большой палец.
 * Пунктов ровно пять — больше не влезает без потери размера цели касания.
 */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Разделы"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md",
        "pb-safe lg:hidden",
      )}
    >
      <ul className="flex items-stretch">
        {NAV_ITEMS.map((item) => {
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
                <span className="text-[10px] font-medium leading-none">{item.shortLabel}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
