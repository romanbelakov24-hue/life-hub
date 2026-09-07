import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/app-shell";
import { ScheduleGrid } from "@/components/study/schedule-grid";
import { requireUser } from "@/lib/auth/user";
import { listScheduleSlots } from "@/lib/queries/study";
import { todayIso, weekdayOf, WEEKDAY_NAMES } from "@/lib/utils/date";

/**
 * Страница «Расписание» — сетка пар на неделю.
 * Вся интерактивность (выбор дня, форма пары) живёт в ScheduleGrid.
 */

export const metadata: Metadata = { title: "Расписание" };

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const user = await requireUser();
  const today = todayIso();
  const todayWeekday = weekdayOf(today);
  const slots = await listScheduleSlots(user.id);

  return (
    <>
      <PageHeader
        eyebrow="Учёба"
        title="Расписание"
        description={`Сегодня ${WEEKDAY_NAMES[todayWeekday].toLowerCase()} · нажмите на ячейку, чтобы добавить или изменить пару`}
      />

      <ScheduleGrid slots={slots} todayWeekday={todayWeekday} />
    </>
  );
}
