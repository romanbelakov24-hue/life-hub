import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/app-shell";
import { TasksView } from "@/components/study/tasks-view";
import { requireUser } from "@/lib/auth/user";
import { getTaskCounters, listSubjects, listTasks } from "@/lib/queries/study";
import { todayIso } from "@/lib/utils/date";
import { pluralize } from "@/lib/utils/format";

/**
 * Страница «Задачи».
 * Переключение «список ↔ матрица Эйзенхауэра» живёт внутри TasksView.
 */

export const metadata: Metadata = { title: "Задачи" };

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const user = await requireUser();
  const today = todayIso();

  const [tasks, subjects, counters] = await Promise.all([
    listTasks(user.id),
    listSubjects(user.id),
    getTaskCounters(user.id, today),
  ]);

  // Три разных состояния: задач нет вовсе, все закрыты, есть открытые.
  const description =
    tasks.length === 0
      ? "Список задач и матрица Эйзенхауэра для приоритизации"
      : counters.open === 0
        ? "Все задачи закрыты"
        : `${counters.open} ${pluralize(counters.open, "открытая", "открытых", "открытых")} ${pluralize(
            counters.open,
            "задача",
            "задачи",
            "задач",
          )}${counters.overdue > 0 ? ` · ${counters.overdue} просрочено` : ""}`;

  return (
    <>
      <PageHeader eyebrow="Учёба" title="Задачи" description={description} />

      <TasksView tasks={tasks} subjects={subjects} today={today} />
    </>
  );
}
