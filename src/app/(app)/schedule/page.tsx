import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/app-shell";
import { EventCalendar } from "@/components/study/event-calendar";
import { requireUser } from "@/lib/auth/user";
import { listEventsInRange } from "@/lib/queries/events";
import {
  endOfMonth,
  endOfWeek,
  monthKeyOf,
  startOfMonth,
  startOfWeek,
  todayIso,
} from "@/lib/utils/date";

/**
 * Страница «Календарь» — дела на конкретные даты, не еженедельная сетка.
 * Пары ВШЭ сюда не попадают: они синхронизируются владельцем напрямую из ЛК
 * в Apple/Google Календарь. Вся интерактивность живёт в EventCalendar.
 */

export const metadata: Metadata = { title: "Календарь" };

export const dynamic = "force-dynamic";

interface SchedulePageProps {
  searchParams: Promise<{ month?: string }>;
}

/** `2026-09` из URL -> первое число месяца. Мусор в параметре игнорируем. */
function resolveMonthAnchor(monthParam: string | undefined, today: string): string {
  if (monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)) {
    return `${monthParam}-01`;
  }
  return startOfMonth(today);
}

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const user = await requireUser();
  const params = await searchParams;

  const today = todayIso();
  const monthAnchor = resolveMonthAnchor(params.month, today);

  // Сетка календаря захватывает целые недели по краям месяца — те же границы,
  // что считает сам EventCalendar, чтобы дела на первой и последней неделе не
  // потерялись.
  const gridStart = startOfWeek(startOfMonth(monthAnchor));
  const gridEnd = endOfWeek(endOfMonth(monthAnchor));

  const events = await listEventsInRange(user.id, gridStart, gridEnd);

  return (
    <>
      <PageHeader
        eyebrow="Учёба"
        title="Календарь"
        description="Разовые встречи, кружки и дедлайны — расписание ВШЭ идёт отдельно, из ЛК"
      />

      <EventCalendar
        monthAnchor={monthAnchor}
        events={events}
        today={today}
        currentMonthKey={monthKeyOf(today)}
      />
    </>
  );
}
