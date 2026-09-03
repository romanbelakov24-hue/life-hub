import type { Metadata } from "next";
import { FileUp } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/app-shell";
import { CategoryManager } from "@/components/expenses/category-manager";
import { CategoryDonut } from "@/components/expenses/charts/category-donut";
import { MonthCompare } from "@/components/expenses/charts/month-compare";
import { SpendingTrend } from "@/components/expenses/charts/spending-trend";
import { ExpensesToolbar } from "@/components/expenses/expenses-toolbar";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { QuickAddExpense } from "@/components/expenses/quick-add";
import { BudgetCard } from "@/components/expenses/budget-card";
import { StatsPanel } from "@/components/expenses/stats-panel";
import { SummaryCards } from "@/components/expenses/summary-cards";
import { buildBudgetForecast } from "@/lib/analytics/budget";
import {
  buildCategoryDetails,
  buildDailyTrend,
  buildMonthlyTrend,
  buildWeeklyTrend,
  computeExpenseStats,
  sumExpenses,
} from "@/lib/analytics/expenses";
import {
  listCategories,
  listExpensesInRange,
  listMonthlyTotals,
  sumExpensesInRange,
} from "@/lib/queries/expenses";
import { getHistoricalDailyRate, sumIncomesInRange } from "@/lib/queries/income";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  formatMonthTitle,
  fromIso,
  monthKeyOf,
  startOfMonth,
  startOfWeek,
  todayIso,
} from "@/lib/utils/date";

/**
 * Страница «Расходы».
 *
 * Серверный компонент: сам ходит в базу и отдаёт готовые данные клиентским
 * виджетам. Состояние страницы (месяц и вид) хранится в URL — см.
 * components/expenses/expenses-toolbar.tsx.
 */

export const metadata: Metadata = { title: "Расходы" };

// Данные меняются после каждой записи — кэшировать рендер нельзя.
export const dynamic = "force-dynamic";

interface ExpensesPageProps {
  searchParams: Promise<{ month?: string; view?: string }>;
}

/** `2026-09` из URL -> первое число месяца. Мусор в параметре игнорируем. */
function resolveMonthAnchor(monthParam: string | undefined, today: string): string {
  if (monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)) {
    return `${monthParam}-01`;
  }
  return startOfMonth(today);
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = await searchParams;

  const today = todayIso();
  const monthAnchor = resolveMonthAnchor(params.month, today);
  const view = params.view === "analytics" ? "analytics" : "list";

  const monthStart = startOfMonth(monthAnchor);
  const monthEnd = endOfMonth(monthAnchor);
  const prevMonthAnchor = addMonths(monthAnchor, -1);

  // Независимые выборки — запускаем параллельно, чтобы не складывать задержки
  // сетевых обращений к Turso.
  const [
    categories,
    expenses,
    prevMonthTotal,
    todayTotal,
    weekTotal,
    monthlyTotals,
    monthIncome,
    historicalDailyRate,
  ] = await Promise.all([
    listCategories(),
    listExpensesInRange(monthStart, monthEnd),
    sumExpensesInRange(startOfMonth(prevMonthAnchor), endOfMonth(prevMonthAnchor)),
    sumExpensesInRange(today, today),
    sumExpensesInRange(startOfWeek(today), endOfWeek(today)),
    listMonthlyTotals(6),
    sumIncomesInRange(monthStart, monthEnd),
    getHistoricalDailyRate(monthKeyOf(monthAnchor)),
  ]);

  const isCurrentMonth = monthKeyOf(monthAnchor) === monthKeyOf(today);

  // Средний расход в день: за текущий месяц делим на прошедшие дни,
  // за прошлый — на полную длину месяца.
  const daysElapsed = isCurrentMonth
    ? fromIso(today).getDate()
    : fromIso(monthEnd).getDate();

  const monthTotal = sumExpenses(expenses);
  const breakdown = buildCategoryDetails(expenses);
  const stats = computeExpenseStats(expenses, prevMonthTotal, daysElapsed);

  const forecast = buildBudgetForecast({
    income: monthIncome,
    spent: monthTotal,
    today,
    monthAnchor,
    historicalDailyRate,
  });

  return (
    <>
      {/* Подзаголовка с месяцем нет намеренно: он дублировал бы переключатель,
          который стоит прямо под ним и показывает то же самое. */}
      <PageHeader
        eyebrow="Финансы"
        title="Расходы"
        actions={
          <ExpensesToolbar
            monthAnchor={monthAnchor}
            view={view}
            currentMonthKey={monthKeyOf(today)}
          >
            <CategoryManager categories={categories} />
            <Link
              href="/expenses/import"
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-line bg-surface-2 px-3 text-[13px] font-medium text-ink transition-colors duration-200 hover:bg-surface-3"
            >
              <FileUp size={15} />
              <span className="hidden sm:inline">Импорт</span>
            </Link>
          </ExpensesToolbar>
        }
      />

      <div className="flex flex-col gap-4">
        <QuickAddExpense categories={categories} defaultDate={today} />

        <BudgetCard forecast={forecast} />

        <SummaryCards
          totals={{
            today: todayTotal,
            week: weekTotal,
            month: monthTotal,
            prevMonth: prevMonthTotal,
          }}
          monthTitle={formatMonthTitle(monthAnchor)}
          isCurrentMonth={isCurrentMonth}
        />

        {view === "list" ? (
          <ExpenseTable expenses={expenses} categories={categories} today={today} />
        ) : (
          // Бенто-сетка: широкие блоки с графиками и узкие со сводками.
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <SpendingTrend
                daily={buildDailyTrend(expenses, monthAnchor)}
                weekly={buildWeeklyTrend(expenses)}
                today={today}
                index={0}
              />
            </div>

            <div className="lg:col-span-2">
              <MonthCompare
                months={buildMonthlyTrend(monthlyTotals)}
                activeMonthKey={monthKeyOf(monthAnchor)}
                index={1}
              />
            </div>

            <div className="lg:col-span-3">
              <CategoryDonut breakdown={breakdown} total={monthTotal} today={today} index={2} />
            </div>

            <div className="lg:col-span-2">
              <StatsPanel stats={stats} daysElapsed={daysElapsed} index={3} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
