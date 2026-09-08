import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/app-shell";
import { EventCalendar, type CalendarView } from "@/components/study/event-calendar";
import { requireUser } from "@/lib/auth/user";
import { listEventsInRange } from "@/lib/queries/events";
import {
  endOfMonth,
  endOfWeek,
  isValidIso,
  startOfMonth,
  startOfWeek,
  todayIso,
} from "@/lib/utils/date";

/**
 * Страница «Календарь» — дела на конкретные даты, не еженедельная сетка.
 * Пары ВШЭ сюда не попадают — они синхронизируются владельцем напрямую из ЛК
 * в Apple/Google Календарь. Вся интерактивность живёт в EventCalendar.
 *
 * Вид (день/неделя/месяц) и дата-якорь — в URL, страница по ним считает, какой
 * диапазон дел запросить: ровно то, что видно на экране в этом виде, не больше.
 */

export const metadata: Metadata = { title: "Календарь" };

export const dynamic = "force-dynamic";

interface SchedulePageProps {
  searchParams: Promise<{ view?: string; date?: string }>;
}

function resolveView(value: string | undefined): CalendarView {
  return value === "day" || value === "week" ? value : "month";
}

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const user = await requireUser();
  const params = await searchParams;

  const today = todayIso();
  const view = resolveView(params.view);
  const anchorDate = params.date && isValidIso(params.date) ? params.date : today;

  // Диапазон запроса ровно под то, что рисует этот вид — сетка месяца
  // захватывает целые недели по краям, у недели и дня диапазон и так точный.
  const [rangeStart, rangeEnd] =
    view === "month"
      ? [startOfWeek(startOfMonth(anchorDate)), endOfWeek(endOfMonth(anchorDate))]
      : view === "week"
        ? [startOfWeek(anchorDate), endOfWeek(anchorDate)]
        : [anchorDate, anchorDate];

  const events = await listEventsInRange(user.id, rangeStart, rangeEnd);

  return (
    <>
      <PageHeader
        eyebrow="Учёба"
        title="Календарь"
        description="Разовые встречи, кружки и дедлайны — расписание ВШЭ идёт отдельно, из ЛК"
      />

      <EventCalendar view={view} anchorDate={anchorDate} events={events} today={today} />
    </>
  );
}
