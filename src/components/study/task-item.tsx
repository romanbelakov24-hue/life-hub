"use client";

import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";

import { IconButton } from "@/components/ui/button";
import { deleteTask, toggleTaskDone } from "@/lib/actions/study";
import { isOverdue } from "@/lib/analytics/tasks";
import type { IsoDate, Task } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { formatDeadline } from "@/lib/utils/date";

/**
 * Одна задача.
 *
 * Используется и в списке по срокам, и в матрице Эйзенхауэра — поэтому
 * компонент ничего не знает о том, где он находится, и не решает, как
 * группировать задачи.
 */

interface TaskItemProps {
  task: Task;
  today: IsoDate;
  onEdit: (task: Task) => void;
  /** Компактный режим — внутри квадрантов матрицы, где меньше места. */
  compact?: boolean;
  /**
   * Разрешает перетаскивание строки (матрица Эйзенхауэра на десктопе).
   * id задачи кладётся в dataTransfer — квадрант-приёмник читает его в onDrop.
   */
  draggable?: boolean;
}

export function TaskItem({
  task,
  today,
  onEdit,
  compact = false,
  draggable = false,
}: TaskItemProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const overdue = isOverdue(task, today);

  function handleToggle() {
    startTransition(async () => {
      await toggleTaskDone(task.id, !task.done);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteTask(task.id);
    });
  }

  return (
    <li
      draggable={draggable}
      onDragStart={
        draggable
          ? (event) => {
              event.dataTransfer.setData("text/plain", task.id);
              event.dataTransfer.effectAllowed = "move";
            }
          : undefined
      }
      className={cn(
        "group flex items-start gap-2.5 rounded-[10px] border border-line bg-surface px-3 py-2.5",
        "transition-colors duration-200 hover:border-line-strong",
        draggable && "cursor-grab active:cursor-grabbing",
        task.done && "opacity-55",
        isPending && "opacity-40",
      )}
    >
      {/* Чекбокс: 24px квадрат в зоне касания 40px. */}
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? "Вернуть в работу" : "Отметить выполненной"}
        onClick={handleToggle}
        disabled={isPending}
        className="-m-2 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center p-2"
      >
        <span
          className={cn(
            "flex h-[22px] w-[22px] items-center justify-center rounded-[7px] border-2",
            "transition-colors duration-200",
            task.done
              ? "border-positive bg-positive text-white"
              : "border-line-strong text-transparent hover:border-accent",
          )}
        >
          <Check size={14} strokeWidth={3} />
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm leading-snug text-ink",
            task.done && "line-through decoration-ink-faint",
          )}
        >
          {task.title}
        </p>

        {task.description && !compact ? (
          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink-muted">
            {task.description}
          </p>
        ) : null}

        {(task.dueDate || task.subject) && !task.done ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {task.dueDate ? (
              <span
                className={cn(
                  "tabular rounded-full px-1.5 py-0.5 text-[11px] font-medium",
                  overdue ? "bg-negative-soft text-negative" : "bg-surface-2 text-ink-muted",
                )}
              >
                {formatDeadline(task.dueDate, today)}
              </span>
            ) : null}

            {task.subject ? (
              <span className="truncate text-[11px] text-ink-faint">{task.subject}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
        {confirmingDelete ? (
          <>
            <IconButton
              label="Подтвердить удаление"
              variant="danger"
              compact
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            </IconButton>
            <IconButton
              label="Отменить удаление"
              compact
              onClick={() => setConfirmingDelete(false)}
            >
              <X size={15} />
            </IconButton>
          </>
        ) : (
          <>
            <IconButton label="Изменить задачу" compact onClick={() => onEdit(task)}>
              <Pencil size={15} />
            </IconButton>
            <IconButton
              label="Удалить задачу"
              variant="danger"
              compact
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 size={15} />
            </IconButton>
          </>
        )}
      </div>
    </li>
  );
}
