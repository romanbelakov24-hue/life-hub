import { PageHeader } from "@/components/layout/app-shell";
import { MoneyCard } from "@/components/overview/money-card";
import { NotesCard } from "@/components/overview/notes-card";
import { TasksCard } from "@/components/overview/tasks-card";
import { TodayCard } from "@/components/overview/today-card";
import { requireUser } from "@/lib/auth/user";
import { buildCategoryBreakdown, sumExpenses } from "@/lib/analytics/expenses";
import { listUpcomingEvents } from "@/lib/queries/events";
import { listExpensesInRange, listRecentExpenses, sumExpensesInRange } from "@/lib/queries/expenses";
import { getTaskCounters, listRecentNotes, listTasksDueBy } from "@/lib/queries/study";
import {
  addDays,
  endOfMonth,
  formatDayMonth,
  formatMonthTitle,
  startOfMonth,
  todayIso,
  weekdayOf,
  WEEKDAY_NAMES,
} from "@/lib/utils/date";

/**
 * Обзор — стартовая страница.
 *
 * Собирает по одному виджету из каждого раздела: сколько потрачено, что
 * сегодня по расписанию, что горит из задач и какие заметки писались недавно.
 * Сама ничего не редактирует (кроме отметки задачи выполненной) — это витрина,
 * а вся работа идёт на профильных страницах.
 */

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const user = await requireUser();
  const today = todayIso();
  const todayWeekday = weekdayOf(today);
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const [
    monthExpenses,
    todayTotal,
    recentExpenses,
    upcomingEvents,
    upcomingTasks,
    taskCounters,
    recentNotes,
  ] = await Promise.all([
    listExpensesInRange(user.id, monthStart, monthEnd),
    sumExpensesInRange(user.id, today, today),
    listRecentExpenses(user.id, 4),
    listUpcomingEvents(user.id, today, 4),
    // «Ближайшие» — всё, что просрочено, плюс горизонт в неделю вперёд.
    listTasksDueBy(user.id, addDays(today, 7), 5),
    getTaskCounters(user.id, today),
    listRecentNotes(user.id, 4),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Обзор"
        title="Сводка"
        description={`${WEEKDAY_NAMES[todayWeekday]}, ${formatDayMonth(today)}`}
      />

      {/* Бенто-сетка: расходы занимают широкую колонку, учёба — узкую. */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <MoneyCard
            index={0}
            todayTotal={todayTotal}
            monthTotal={sumExpenses(monthExpenses)}
            monthTitle={formatMonthTitle(today)}
            breakdown={buildCategoryBreakdown(monthExpenses)}
            recentExpenses={recentExpenses}
          />
        </div>

        <div className="lg:col-span-2">
          <TodayCard events={upcomingEvents} today={today} index={1} />
        </div>

        <div className="lg:col-span-3">
          <TasksCard tasks={upcomingTasks} today={today} counters={taskCounters} index={2} />
        </div>

        <div className="lg:col-span-2">
          <NotesCard notes={recentNotes} index={3} />
        </div>
      </div>
    </>
  );
}
