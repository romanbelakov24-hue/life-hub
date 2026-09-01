"use client";

import { Grid2x2, ListChecks, Loader2, Plus, Sparkles } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { EisenhowerMatrix } from "@/components/study/eisenhower-matrix";
import { TaskForm } from "@/components/study/task-form";
import { TaskItem } from "@/components/study/task-item";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/misc";
import { Panel } from "@/components/ui/panel";
import { clearCompletedTasks, createTask } from "@/lib/actions/study";
import { groupTasksByDue } from "@/lib/analytics/tasks";
import type { IsoDate, Task } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { pluralize } from "@/lib/utils/format";

/**
 * Раздел задач: список по срокам ↔ матрица Эйзенхауэра.
 *
 * Переключатель вида хранится в состоянии компонента, а не в URL: это способ
 * посмотреть на те же задачи под другим углом, а не отдельная страница.
 * Быстрое добавление создаёт задачу «важно, не срочно» — самый частый случай;
 * приоритет и дедлайн уточняются позже одним кликом.
 */

type ViewMode = "list" | "matrix";

interface TasksViewProps {
  tasks: Task[];
  subjects: string[];
  today: IsoDate;
}

export function TasksView({ tasks, subjects, today }: TasksViewProps) {
  const [view, setView] = useState<ViewMode>("list");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const openTasks = tasks.filter((task) => !task.done);
  const doneTasks = tasks.filter((task) => task.done);

  function openEditor(task: Task | null) {
    setEditingTask(task);
    setIsFormOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <QuickAddTask />

      {/* Панель управления: вид + создание задачи */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Вид задач"
          className="inline-flex rounded-full border border-line bg-surface p-1"
        >
          {(
            [
              { value: "list", label: "Список", icon: ListChecks },
              { value: "matrix", label: "Матрица", icon: Grid2x2 },
            ] as const
          ).map((option) => {
            const Icon = option.icon;
            const isActive = view === option.value;

            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setView(option.value)}
                className={cn(
                  "flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3",
                  "text-[13px] font-medium transition-colors duration-200",
                  isActive ? "bg-accent text-accent-ink" : "text-ink-muted hover:text-ink",
                )}
              >
                <Icon size={15} />
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {doneTasks.length > 0 ? <ClearCompletedButton count={doneTasks.length} /> : null}

          <Button size="sm" variant="secondary" onClick={() => openEditor(null)}>
            <Plus size={15} />
            Задача
          </Button>
        </div>
      </div>

      {openTasks.length === 0 && doneTasks.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Sparkles}
            title="Задач нет"
            description="Добавьте первую задачу строкой выше — дедлайн и приоритет можно указать позже."
          />
        </Panel>
      ) : view === "list" ? (
        <TaskGroups
          tasks={tasks}
          doneTasks={doneTasks}
          today={today}
          onEdit={openEditor}
        />
      ) : (
        <>
          <EisenhowerMatrix tasks={tasks} today={today} onEdit={openEditor} />
          <p className="text-[12px] text-ink-faint">
            На компьютере задачи можно перетаскивать между квадрантами. На телефоне
            приоритет меняется в форме задачи.
          </p>
        </>
      )}

      <TaskForm
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        task={editingTask}
        subjects={subjects}
      />
    </div>
  );
}

// ─── Список, сгруппированный по срокам ───────────────────────────────────────

function TaskGroups({
  tasks,
  doneTasks,
  today,
  onEdit,
}: {
  tasks: Task[];
  doneTasks: Task[];
  today: IsoDate;
  onEdit: (task: Task) => void;
}) {
  const [showDone, setShowDone] = useState(false);
  const groups = useMemo(() => groupTasksByDue(tasks, today), [tasks, today]);

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <section key={group.bucket}>
          <header className="mb-2 flex items-baseline justify-between gap-2">
            <h2
              className={cn(
                "eyebrow",
                // Просроченное подсвечиваем — это единственная группа,
                // требующая немедленной реакции.
                group.bucket === "overdue" && "text-negative",
              )}
            >
              {group.label}
            </h2>
            <span className="tabular text-[11px] text-ink-faint">{group.items.length}</span>
          </header>

          <ul className="flex flex-col gap-1.5">
            {group.items.map((task) => (
              <TaskItem key={task.id} task={task} today={today} onEdit={onEdit} />
            ))}
          </ul>
        </section>
      ))}

      {doneTasks.length > 0 ? (
        <section>
          <button
            type="button"
            onClick={() => setShowDone((value) => !value)}
            aria-expanded={showDone}
            className="mb-2 flex cursor-pointer items-center gap-2 text-ink-faint transition-colors duration-200 hover:text-ink"
          >
            <span className="eyebrow">Выполнено</span>
            <span className="tabular text-[11px]">
              {doneTasks.length} {pluralize(doneTasks.length, "задача", "задачи", "задач")}
            </span>
            <span className="text-[11px]">{showDone ? "скрыть" : "показать"}</span>
          </button>

          {showDone ? (
            <ul className="flex flex-col gap-1.5">
              {doneTasks.map((task) => (
                <TaskItem key={task.id} task={task} today={today} onEdit={onEdit} />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

// ─── Быстрое добавление ──────────────────────────────────────────────────────

function QuickAddTask() {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;

    setError(null);
    startTransition(async () => {
      const result = await createTask({
        title,
        description: "",
        dueDate: "",
        urgent: false,
        important: true,
        subject: "",
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTitle("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[14px] border border-line bg-surface p-3">
      <div className="flex gap-2">
        <Field label="Новая задача" hideLabel className="flex-1" error={error ?? undefined}>
          {(id) => (
            <TextInput
              id={id}
              value={title}
              maxLength={160}
              placeholder="Добавить задачу…"
              enterKeyHint="done"
              onChange={(event) => setTitle(event.target.value)}
            />
          )}
        </Field>

        <Button type="submit" variant="primary" disabled={isPending || !title.trim()}>
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          <span className="hidden sm:inline">Добавить</span>
        </Button>
      </div>
    </form>
  );
}

// ─── Очистка выполненных ─────────────────────────────────────────────────────

function ClearCompletedButton({ count }: { count: number }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!isConfirming) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setIsConfirming(true)}>
        Очистить выполненные
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-[12px] text-ink-muted">Удалить {count}?</span>
      <Button
        size="sm"
        variant="danger"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await clearCompletedTasks();
            setIsConfirming(false);
          })
        }
      >
        {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
        Да
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setIsConfirming(false)}>
        Нет
      </Button>
    </div>
  );
}
