import { Settings } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { MobileNav } from "@/components/layout/mobile-nav";
import { RouteProgress } from "@/components/layout/route-progress";
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
      {/* useSearchParams требует границу Suspense — сама полоса ничего не
          ждёт, fallback ей не нужен. */}
      <Suspense fallback={null}>
        <RouteProgress />
      </Suspense>

      <Sidebar />

      {/* Шапка только для мобильных — на десктопе её роль играет сайдбар. */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-3 backdrop-blur-md lg:hidden">
        <Wordmark compact />

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Link
            href="/settings"
            aria-label="Настройки"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors duration-200 active:text-ink"
          >
            <Settings size={17} />
          </Link>
        </div>
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

/**
 * Единая шапка страницы — одинаковый ритм во всех разделах.
 *
 * За заголовком лежит его же контурное «эхо» вчетверо крупнее: приём даёт
 * странице масштаб и слой глубины, оставаясь чистой декорацией — от
 * скринридеров он скрыт, а слой обрезан по ширине шапки, чтобы крупная
 * надпись не растянула страницу вбок.
 */
export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="relative mb-5 border-b border-line pb-5 sm:mb-6">
      {/* Контурная подложка. Обрезается своим слоем, а не всей шапкой, —
          иначе клипались бы кольца фокуса на кнопках справа. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <span className="ghost-title animate-fade absolute -left-1 top-2 text-[56px] opacity-25 sm:-left-2 sm:-top-5 sm:text-[88px] sm:opacity-45 lg:text-[104px]">
          {title}
        </span>
      </div>

      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="animate-rise min-w-0">
          <p className="eyebrow mb-2">{eyebrow}</p>
          <h1 className="font-display text-[26px] font-bold leading-none tracking-[-0.03em] text-ink sm:text-[34px]">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 text-[13px] text-ink-muted sm:text-sm">{description}</p>
          ) : null}
        </div>

        {actions ? (
          <div className="animate-rise stagger flex w-full flex-wrap items-center gap-2 sm:w-auto" style={{ "--i": 1 } as React.CSSProperties}>
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
