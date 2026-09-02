"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { CategoryWithItems } from "@/lib/analytics/expenses";
import type { IsoDate } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { formatDayMonthShort, formatRelativeDay } from "@/lib/utils/date";
import { formatNumber, formatRub, pluralize } from "@/lib/utils/format";

/**
 * Разбивка по категориям, которая раскрывается в список покупок.
 *
 * Свёрнутое состояние отвечает на вопрос «куда уходит», раскрытое — «из чего
 * это сложилось». Второе нужно редко, поэтому по умолчанию закрыто и не
 * загромождает страницу.
 *
 * Раскрытие анимируется через grid-template-rows (класс .collapsible): это
 * единственный способ доехать до высоты «по содержимому» без замера высоты
 * в JavaScript.
 *
 * Содержимое рендерится всегда, даже когда категория свёрнута. Это осознанно:
 * покупки уже пришли с сервера вместе со страницей, а постоянное присутствие
 * в разметке позволяет анимировать раскрытие и оставляет текст доступным
 * поиску по странице. Скрытая часть помечена aria-hidden, чтобы скринридер
 * не читал свёрнутое.
 */

interface CategoryBreakdownListProps {
  categories: CategoryWithItems[];
  /** Сегодняшняя дата — для подписей «Сегодня» / «Вчера». */
  today: IsoDate;
  /** Сколько категорий показывать; остальные сворачиваются в одну строку. */
  limit?: number;
  /** Крупная вёрстка для страницы-отчёта; по умолчанию компактная. */
  variant?: "report" | "compact";
}

export function CategoryBreakdownList({
  categories,
  today,
  limit,
  variant = "compact",
}: CategoryBreakdownListProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const visible = limit ? categories.slice(0, limit) : categories;
  const restTotal = limit
    ? categories.slice(limit).reduce((sum, item) => sum + item.total, 0)
    : 0;

  const isReport = variant === "report";

  return (
    <>
      <ul className={cn("flex flex-col", isReport ? "gap-4" : "gap-2.5")}>
        {visible.map((category) => {
          const isOpen = openId === category.categoryId;
          const panelId = `cat-${category.categoryId}`;

          return (
            <li key={category.categoryId}>
              {/* Заголовок категории — он же кнопка раскрытия */}
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : category.categoryId)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className={cn(
                  "group w-full cursor-pointer rounded-[10px] text-left",
                  "transition-colors duration-200",
                  isReport ? "-mx-2 px-2 py-1.5" : "-mx-1.5 px-1.5 py-1",
                  "hover:bg-surface-2/60",
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <ChevronDown
                      size={isReport ? 15 : 13}
                      className={cn(
                        "shrink-0 text-ink-faint transition-transform duration-300",
                        isOpen && "rotate-180",
                      )}
                    />
                    <span
                      className={cn(
                        "truncate text-ink",
                        isReport ? "text-[15px]" : "text-[13px]",
                      )}
                    >
                      {category.name}
                    </span>
                    <span className="tabular shrink-0 text-[11px] text-ink-faint">
                      {category.count}
                    </span>
                  </span>

                  <span
                    className={cn(
                      "tabular shrink-0 text-ink-muted",
                      isReport ? "text-[14px]" : "text-[12px]",
                    )}
                  >
                    {formatRub(category.total, 0)}
                    {isReport ? null : (
                      <span className="ml-1.5 text-ink-faint">
                        {formatNumber(category.share, 0)}%
                      </span>
                    )}
                  </span>
                </div>

                {/* Полоса доли */}
                <div className={cn("flex items-center gap-3", isReport ? "mt-2" : "mt-1.5")}>
                  <div
                    className={cn(
                      "flex-1 overflow-hidden rounded-full bg-surface-2",
                      isReport ? "h-2" : "h-1.5",
                    )}
                  >
                    <div
                      className="animate-grow h-full rounded-full transition-[filter] duration-200 group-hover:brightness-110"
                      style={
                        {
                          "--w": `${category.share}%`,
                          backgroundColor: category.color,
                        } as React.CSSProperties
                      }
                    />
                  </div>

                  {isReport ? (
                    <span className="tabular w-11 shrink-0 text-right text-[12px] text-ink-faint">
                      {formatNumber(category.share, 0)}%
                    </span>
                  ) : null}
                </div>
              </button>

              {/* Раскрывающийся список покупок */}
              <div className="collapsible" data-open={isOpen}>
                <div>
                  <ul
                    id={panelId}
                    aria-hidden={!isOpen}
                    className={cn(
                      "mt-2 flex flex-col gap-px overflow-hidden rounded-[10px] border border-line bg-line",
                      isReport ? "ml-6" : "ml-5",
                    )}
                  >
                    {category.items.map((expense) => (
                      <li
                        key={expense.id}
                        className="flex items-baseline justify-between gap-3 bg-surface px-3 py-2"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] text-ink">
                            {expense.note || category.name}
                          </span>
                          <span className="tabular block text-[11px] text-ink-faint">
                            {formatRelativeDay(expense.date, today)}
                          </span>
                        </span>

                        <span className="tabular shrink-0 text-[13px] font-medium text-ink">
                          {formatRub(expense.amount, 0)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <p
                    aria-hidden={!isOpen}
                    className={cn("mt-1.5 text-[11px] text-ink-faint", isReport ? "ml-6" : "ml-5")}
                  >
                    {category.count}{" "}
                    {pluralize(category.count, "покупка", "покупки", "покупок")} с{" "}
                    {formatDayMonthShort(
                      category.items[category.items.length - 1]?.date ?? today,
                    )}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {restTotal > 0 ? (
        <p className={cn("text-[13px] text-ink-faint", isReport ? "mt-4" : "mt-3")}>
          Остальные категории — {formatRub(restTotal, 0)}
        </p>
      ) : null}
    </>
  );
}
