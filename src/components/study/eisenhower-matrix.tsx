"use client";

import { useState, useTransition } from "react";

import { TaskItem } from "@/components/study/task-item";
import { setTaskQuadrant } from "@/lib/actions/study";
import { QUADRANTS, groupTasksByQuadrant } from "@/lib/analytics/tasks";
import type { IsoDate, Quadrant, Task } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

/**
 * Матрица Эйзенхауэра — четыре квадранта по осям «срочно» и «важно».
 *
 * Перетаскивание работает на десктопе (обычный HTML5 drag-and-drop, без
 * библиотек). На телефоне перетаскивание недоступно, поэтому приоритет там
 * меняется через форму задачи — она умеет то же самое и остаётся основным,
 * доступным с клавиатуры способом.
 */

interface EisenhowerMatrixProps {
  tasks: Task[];
  today: IsoDate;
  onEdit: (task: Task) => void;
}

export function EisenhowerMatrix({ tasks, today, onEdit }: EisenhowerMatrixProps) {
  const [dragOverQuadrant, setDragOverQuadrant] = useState<Quadrant | null>(null);
  const [, startTransition] = useTransition();

  // В матрицу попадают только незавершённые задачи: выполненные не нуждаются
  // в приоритизации и только засоряют квадранты.
  const groups = groupTasksByQuadrant(tasks.filter((task) => !task.done));

  function handleDrop(quadrantId: Quadrant, taskId: string) {
    const quadrant = QUADRANTS.find((item) => item.id === quadrantId);
    if (!quadrant || !taskId) return;

    startTransition(async () => {
      await setTaskQuadrant(taskId, quadrant.urgent, quadrant.important);
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {QUADRANTS.map((quadrant) => {
        const items = groups[quadrant.id];
        const isDragTarget = dragOverQuadrant === quadrant.id;

        return (
          <section
            key={quadrant.id}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOverQuadrant(quadrant.id);
            }}
            onDragLeave={() => setDragOverQuadrant(null)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOverQuadrant(null);
              handleDrop(quadrant.id, event.dataTransfer.getData("text/plain"));
            }}
            data-spotlight
            className={cn(
              "spotlight relative flex min-h-[180px] flex-col rounded-[14px] border bg-surface/85 p-3.5 backdrop-blur-xl",
              "transition-colors duration-200",
              isDragTarget ? "border-accent bg-accent-soft" : "border-line",
            )}
          >
            <header className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                {/* Цветная засечка квадранта — единственный носитель цвета здесь. */}
                <span
                  className="mt-0.5 h-8 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: quadrant.accentVar }}
                  aria-hidden
                />
                <div>
                  <h3 className="text-[13px] font-semibold leading-tight text-ink">
                    {quadrant.title}
                  </h3>
                  <p className="mt-0.5 text-[11px] leading-tight text-ink-faint">
                    {quadrant.action}
                  </p>
                </div>
              </div>

              <span className="tabular shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-muted">
                {items.length}
              </span>
            </header>

            {items.length === 0 ? (
              <p className="flex flex-1 items-center justify-center rounded-[10px] border border-dashed border-line px-3 py-6 text-center text-[12px] text-ink-faint">
                Пусто
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {items.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    today={today}
                    onEdit={onEdit}
                    compact
                    draggable
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
