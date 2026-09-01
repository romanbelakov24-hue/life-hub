import type { ReactNode } from "react";

import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar, Wordmark } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";

/**
 * Каркас приложения.
 *
 * Десктоп: фиксированный сайдбар слева + контент со сдвигом.
 * Телефон: компактная шапка сверху и таб-бар снизу; контенту добавляется
 * нижний отступ, чтобы последняя строка не пряталась под таб-баром.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative z-10 min-h-dvh">
      <Sidebar />

      {/* Шапка только для мобильных — на десктопе её роль играет сайдбар. */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-3 backdrop-blur-md lg:hidden">
        <Wordmark compact />
        <ThemeToggle />
      </header>

      <main className="lg:pl-60">
        <div className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-5 sm:px-6 sm:pt-6 lg:pb-10">
          {children}
        </div>
      </main>

      <MobileNav />
    </div>
  );
}

interface PageHeaderProps {
  /** Микро-подпись над заголовком — раздел, к которому относится страница. */
  eyebrow: string;
  title: string;
  description?: string;
  /** Управляющие элементы страницы: переключатели периода, кнопки. */
  actions?: ReactNode;
}

/** Единая шапка страницы — одинаковый ритм во всех разделах. */
export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5 sm:mb-6">
      <div className="min-w-0">
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h1 className="font-display text-[26px] font-bold leading-none tracking-[-0.03em] text-ink sm:text-[34px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-[13px] text-ink-muted sm:text-sm">{description}</p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>
      ) : null}
    </div>
  );
}
