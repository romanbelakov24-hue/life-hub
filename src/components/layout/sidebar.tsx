"use client";

import { Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NAV_ITEMS, SECTION_LABELS, SECTION_ORDER, isNavItemActive } from "@/config/nav";
import { cn } from "@/lib/utils/cn";

/**
 * Боковая навигация — только для экранов от lg (1024px).
 * На телефоне её заменяет нижний таб-бар (mobile-nav.tsx).
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="glass-blur fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface/85 lg:flex">
      <div className="px-5 py-6">
        <Wordmark />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {SECTION_ORDER.map((section) => {
          const items = NAV_ITEMS.filter((item) => item.section === section);
          if (items.length === 0) return null;

          return (
            <div key={section} className="mb-5">
              <p className="eyebrow px-3 pb-2">{SECTION_LABELS[section]}</p>

              <ul className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = isNavItemActive(item.href, pathname);

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "group relative flex items-center gap-2.5 rounded-[10px] px-3 py-2.5",
                          "text-sm transition-[background-color,color] duration-200",
                          isActive
                            ? "bg-accent-soft font-medium text-accent"
                            : "text-ink-muted hover:bg-surface-2 hover:text-ink",
                        )}
                      >
                        {/* Вертикальная засечка активного пункта — «закладка» в журнале. */}
                        <span
                          className={cn(
                            "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent",
                            "transition-opacity duration-200",
                            isActive ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <Icon size={17} className="shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-4">
        <ThemeToggle />

        {/* Настройки живут вне основной навигации: заходят туда редко, а место
            в списке разделов дороже. */}
        <Link
          href="/settings"
          aria-label="Настройки"
          title="Настройки"
          className={cn(
            "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full",
            "transition-colors duration-200",
            pathname === "/settings"
              ? "bg-accent-soft text-accent"
              : "text-ink-faint hover:bg-surface-2 hover:text-ink",
          )}
        >
          <Settings size={16} />
        </Link>
      </div>
    </aside>
  );
}

/** Логотип-надпись. Акцентная точка — единственный «декор» в интерфейсе. */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-baseline gap-1.5">
      <span
        className={cn(
          "font-display font-bold tracking-[-0.04em] text-ink",
          compact ? "text-lg" : "text-[22px]",
        )}
      >
        life
      </span>
      <span
        className={cn(
          "font-display font-bold tracking-[-0.04em] text-accent",
          compact ? "text-lg" : "text-[22px]",
        )}
      >
        hub
      </span>
      <span className="mb-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
    </Link>
  );
}
