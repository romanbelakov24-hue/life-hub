"use client";

import { ArrowUpRight, Check, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import { Panel, PanelHeader } from "@/components/ui/panel";
import { toggleTaskDone } from "@/lib/actions/study";
import { isOverdue } from "@/lib/analytics/tasks";
import type { IsoDate, Task } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { formatDeadline } from "@/lib/utils/date";

/**
 * Ближайшие задачи на «Обзоре».
 *
 * Здесь намеренно нет редактирования и удаления — только отметка «сделано».
 * Обзор нужен, чтобы за секунду понять статус дня и закрыть пару пунктов;
 * всё остальное делается на странице задач.
 */

interface TasksCardProps {
  tasks: Task[];
  today: IsoDate;
  /** Счётчики со страницы задач — показываем сводку в заголовке. */
  counters: { open: number; overdue: number; doneToday: number };
}

export function TasksCard({ tasks, today, counters }: TasksCardProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <Panel className="flex flex-col">
      <PanelHeader
        eyebrow="Учёба"
        title="Ближайшие задачи"
        description={
          counters.overdue > 0
            ? `${counters.overdue} просрочено · ${counters.open} открыто`
            : `${counters.open} открыто · ${counters.doneToday} закрыто сегодня`
        }
        actions={
          <Link
            href="/tasks"
            className="flex h-9 cursor-pointer items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-ink-muted transition-colors duration-200 hover:text-accent"
          >
            Все задачи
            <ArrowUpRight size={14} />
          </Link>
        }
      />

      {tasks.length === 0 ? (
        <p className="mt-4 flex flex-1 items-center gap-2 rounded-[10px] bg-positive-soft px-3 py-3 text-[12px] text-positive">
          <CheckCircle2 size={14} className="shrink-0" />
          На ближайшие дни всё закрыто.
        </p>
      ) : (
        <ul className={cn("mt-4 flex flex-col gap-1.5", isPending && "opacity-60")}>
          {tasks.map((task) => {
            const overdue = isOverdue(task, today);

            return (
              <li key={task.id} className="flex items-center gap-2.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={false}
                  aria-label={`Отметить «${task.title}» выполненной`}
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await toggleTaskDone(task.id, true);
                    })
                  }
                  className="-m-2 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center p-2"
                >
                  <span className="flex h-[20px] w-[20px] items-center justify-center rounded-[6px] border-2 border-line-strong text-transparent transition-colors duration-200 hover:border-accent">
                    <Check size={13} strokeWidth={3} />
                  </span>
                </button>

                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                  {task.title}
                </span>

                {task.dueDate ? (
                  <span
                    className={cn(
                      "tabular shrink-0 rounded-full px-1.5 py-0.5 text-[11px]",
                      overdue ? "bg-negative-soft text-negative" : "bg-surface-2 text-ink-muted",
                    )}
                  >
                    {formatDeadline(task.dueDate, today)}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
