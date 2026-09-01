"use client";

import { Receipt } from "lucide-react";
import { useMemo, useState } from "react";

import { ExpenseRow } from "@/components/expenses/expense-row";
import { Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/misc";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { groupExpensesByDate } from "@/lib/analytics/expenses";
import type { Category, ExpenseWithCategory, IsoDate } from "@/lib/types";
import { formatRelativeDay, weekdayOf, WEEKDAY_SHORT } from "@/lib/utils/date";
import { formatRub, pluralize } from "@/lib/utils/format";

/**
 * Таблица трат, сгруппированная по дням.
 *
 * Группировка по дате вместо плоского списка: так сразу видно, сколько ушло
 * за конкретный день, и не нужен отдельный отчёт «по дням».
 * Фильтр по категории живёт в состоянии компонента — он не меняет URL,
 * потому что это временный взгляд на данные, а не отдельная страница.
 */

interface ExpenseTableProps {
  expenses: ExpenseWithCategory[];
  categories: Category[];
  /** Сегодняшняя дата с сервера — для подписей «Сегодня» / «Вчера». */
  today: IsoDate;
}

export function ExpenseTable({ expenses, categories, today }: ExpenseTableProps) {
  const [categoryFilter, setCategoryFilter] = useState("all");

  const visibleExpenses = useMemo(
    () =>
      categoryFilter === "all"
        ? expenses
        : expenses.filter((expense) => expense.categoryId === categoryFilter),
    [expenses, categoryFilter],
  );

  const groups = useMemo(() => groupExpensesByDate(visibleExpenses), [visibleExpenses]);

  return (
    <Panel flush>
      <div className="p-4 sm:p-5">
        <PanelHeader
          eyebrow="Журнал"
          title="Траты за месяц"
          description={`${visibleExpenses.length} ${pluralize(
            visibleExpenses.length,
            "запись",
            "записи",
            "записей",
          )}`}
          actions={
            <Select
              aria-label="Фильтр по категории"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-9 w-auto min-w-[140px] text-[13px]"
            >
              <option value="all">Все категории</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          }
        />
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Пока пусто"
          description={
            categoryFilter === "all"
              ? "Добавьте первую трату строкой выше — например, «Кофе 400»."
              : "В этой категории за месяц трат не было."
          }
          className="border-t border-line"
        />
      ) : (
        <div className="border-t border-line">
          {groups.map((group) => (
            <div key={group.date}>
              {/* Заголовок дня: дата слева, итог дня справа. */}
              <div className="flex items-baseline justify-between gap-3 bg-surface-2/70 px-3 py-1.5 sm:px-4">
                <p className="text-[12px] font-medium text-ink-muted">
                  {formatRelativeDay(group.date, today)}
                  <span className="ml-1.5 text-ink-faint">
                    {WEEKDAY_SHORT[weekdayOf(group.date)]}
                  </span>
                </p>
                <p className="tabular text-[12px] font-medium text-ink-muted">
                  {formatRub(group.total)}
                </p>
              </div>

              <ul>
                {group.items.map((expense) => (
                  <ExpenseRow key={expense.id} expense={expense} categories={categories} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
