import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SummaryReport } from "@/components/share/summary-report";
import {
  buildCategoryDetails,
  buildDailyTrend,
  sumExpenses,
} from "@/lib/analytics/expenses";
import { listExpensesInRange, sumExpensesInRange } from "@/lib/queries/expenses";
import { isShareEnabled, SHARE_TOKEN_KEY, findUserIdByToken } from "@/lib/queries/settings";
import {
  addMonths,
  endOfMonth,
  formatMonthTitle,
  fromIso,
  startOfMonth,
  todayIso,
} from "@/lib/utils/date";
import { roundTo } from "@/lib/utils/format";

/**
 * Публичная сводка трат: `/s/<токен>`
 *
 * Лежит вне группы `(app)`, поэтому открывается без навигации приложения.
 * Это принципиально: у сайта нет авторизации, и меню на странице, которой
 * делятся с другими, вело бы прямо ко всем личным данным.
 *
 * Страница всегда показывает текущий месяц — ссылку достаточно отправить один
 * раз, дальше она обновляется сама.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Сводка трат",
  description: "Краткая сводка расходов за месяц",
  // Страница не должна попадать в поисковую выдачу: её адрес — это её защита.
  robots: { index: false, follow: false, nocache: true },
};

export default async function SharedSummaryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Выключенный доступ и неверный токен ведут себя одинаково — страницы просто
  // «не существует». Иначе по разнице ответов можно было бы понять, что адрес
  // угадан верно, а доступ временно закрыт.
  const userId = await findUserIdByToken(SHARE_TOKEN_KEY, token);
  const enabled = userId ? await isShareEnabled(userId) : false;
  if (!userId || !enabled) {
    notFound();
  }

  const today = todayIso();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const prevMonth = addMonths(today, -1);

  const [expenses, prevTotal] = await Promise.all([
    listExpensesInRange(userId, monthStart, monthEnd),
    sumExpensesInRange(userId, startOfMonth(prevMonth), endOfMonth(prevMonth)),
  ]);

  const total = sumExpenses(expenses);
  const daysElapsed = fromIso(today).getDate();

  const changePercent =
    prevTotal > 0 ? roundTo(((total - prevTotal) / prevTotal) * 100, 1) : null;

  // «Сентябрь 2026» -> «Сентябрь» + 2026: в заголовке они разного размера.
  const [monthName, yearText] = formatMonthTitle(today).split(" ");

  return (
    <main className="relative z-10 min-h-dvh">
      <SummaryReport
        monthName={monthName ?? ""}
        year={Number(yearText)}
        total={total}
        changePercent={changePercent}
        categories={buildCategoryDetails(expenses)}
        daily={buildDailyTrend(expenses, today)}
        today={today}
        transactionCount={expenses.length}
        averagePerDay={daysElapsed > 0 ? roundTo(total / daysElapsed, 2) : 0}
        daysElapsed={daysElapsed}
      />
    </main>
  );
}
