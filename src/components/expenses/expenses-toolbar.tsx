"use client";

import { BarChart3, ChevronLeft, ChevronRight, List } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { addMonths, formatMonthTitle, monthKeyOf } from "@/lib/utils/date";

/**
 * Панель управления страницей расходов: выбор месяца и переключение вида.
 *
 * Оба параметра живут в URL (`?month=2026-09&view=analytics`), а не в
 * состоянии компонента: ссылку на конкретный месяц можно сохранить, кнопка
 * «назад» в браузере работает предсказуемо, а серверный компонент получает
 * всё, что нужно для выборки, без клиентских запросов.
 */

interface ExpensesToolbarProps {
  /** Первое число выбранного месяца. */
  monthAnchor: string;
  view: "list" | "analytics";
  /** Текущий месяц — кнопка «сегодня» неактивна, если мы уже на нём. */
  currentMonthKey: string;
}

export function ExpensesToolbar({ monthAnchor, view, currentMonthKey }: ExpensesToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /** Собирает URL, меняя только указанные параметры. */
  function buildHref(changes: Record<string, string>): string {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      params.set(key, value);
    }
    return `${pathname}?${params.toString()}`;
  }

  function goToMonth(offset: number): void {
    router.push(buildHref({ month: monthKeyOf(addMonths(monthAnchor, offset)) }));
  }

  const isCurrentMonth = monthKeyOf(monthAnchor) === currentMonthKey;

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      {/* Переключатель месяца */}
      <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
        <IconButton label="Предыдущий месяц" compact onClick={() => goToMonth(-1)}>
          <ChevronLeft size={17} />
        </IconButton>

        <span className="min-w-[124px] text-center text-[13px] font-medium text-ink">
          {formatMonthTitle(monthAnchor)}
        </span>

        <IconButton
          label="Следующий месяц"
          compact
          onClick={() => goToMonth(1)}
          disabled={isCurrentMonth}
        >
          <ChevronRight size={17} />
        </IconButton>
      </div>

      {/* Переключатель вида: журнал / аналитика */}
      <div
        role="tablist"
        aria-label="Вид страницы"
        className="flex items-center rounded-full border border-line bg-surface p-1"
      >
        {(
          [
            { value: "list", label: "Журнал", icon: List },
            { value: "analytics", label: "Аналитика", icon: BarChart3 },
          ] as const
        ).map((option) => {
          const Icon = option.icon;
          const isActive = view === option.value;

          return (
            <Link
              key={option.value}
              href={buildHref({ view: option.value })}
              role="tab"
              aria-selected={isActive}
              scroll={false}
              className={cn(
                "flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3",
                "text-[13px] font-medium transition-colors duration-200",
                isActive ? "bg-accent text-accent-ink" : "text-ink-muted hover:text-ink",
              )}
            >
              <Icon size={15} />
              {option.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
