"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, Select, Textarea, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { QUADRANTS, quadrantOf } from "@/lib/analytics/tasks";
import { createTask, updateTask } from "@/lib/actions/study";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

/**
 * Форма задачи.
 *
 * Приоритет задаётся не двумя чекбоксами «срочно» и «важно», а выбором
 * квадранта матрицы Эйзенхауэра: так видно, что именно означает сочетание
 * флагов, и не приходится держать матрицу в голове.
 */

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  /** Редактируемая задача; null — создание новой. */
  task: Task | null;
  /** Предметы из расписания — подсказки для привязки. */
  subjects: string[];
}

export function TaskForm({ open, onClose, task, subjects }: TaskFormProps) {
  if (!open) return null;

  // key пересоздаёт форму при смене задачи, иначе в полях останутся
  // значения предыдущей.
  return (
    <TaskFormBody key={task?.id ?? "new"} onClose={onClose} task={task} subjects={subjects} />
  );
}

function TaskFormBody({ onClose, task, subjects }: Omit<TaskFormProps, "open">) {
  const [draft, setDraft] = useState({
    title: task?.title ?? "",
    description: task?.description ?? "",
    dueDate: task?.dueDate ?? "",
    urgent: task?.urgent ?? false,
    important: task?.important ?? true,
    subject: task?.subject ?? "",
  });

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeQuadrant = quadrantOf(draft);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = task
        ? await updateTask(task.id, draft)
        : await createTask(draft);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={task ? "Изменить задачу" : "Новая задача"}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" form="task-form" variant="primary" disabled={isPending}>
            {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
            Сохранить
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Что нужно сделать">
          {(id) => (
            <TextInput
              id={id}
              value={draft.title}
              autoFocus
              maxLength={160}
              placeholder="Например: сдать лабораторную по физике"
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          )}
        </Field>

        <Field label="Детали" hint="Необязательно">
          {(id) => (
            <Textarea
              id={id}
              value={draft.description}
              rows={3}
              placeholder="Что именно, где искать материалы, что уже сделано"
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Дедлайн" hint="Пусто — без срока">
            {(id) => (
              <TextInput
                id={id}
                type="date"
                value={draft.dueDate}
                onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })}
              />
            )}
          </Field>

          <Field label="Предмет">
            {(id) => (
              <Select
                id={id}
                value={draft.subject}
                onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
              >
                <option value="">Без предмета</option>
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
                {/* Предмет задачи мог быть удалён из расписания — не теряем его. */}
                {draft.subject && !subjects.includes(draft.subject) ? (
                  <option value={draft.subject}>{draft.subject}</option>
                ) : null}
              </Select>
            )}
          </Field>
        </div>

        {/* Приоритет = квадрант матрицы Эйзенхауэра. */}
        <div>
          <p className="mb-1.5 text-[12px] font-medium text-ink-muted">Приоритет</p>

          <div className="grid grid-cols-2 gap-1.5">
            {QUADRANTS.map((quadrant) => {
              const isActive = activeQuadrant === quadrant.id;

              return (
                <button
                  key={quadrant.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      urgent: quadrant.urgent,
                      important: quadrant.important,
                    })
                  }
                  className={cn(
                    "cursor-pointer rounded-[10px] border px-3 py-2.5 text-left",
                    "transition-colors duration-200",
                    isActive
                      ? "border-transparent bg-surface-3"
                      : "border-line hover:bg-surface-2",
                  )}
                  style={isActive ? { boxShadow: `inset 3px 0 0 ${quadrant.accentVar}` } : undefined}
                >
                  <span className="block text-[12px] font-semibold text-ink">
                    {quadrant.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-tight text-ink-faint">
                    {quadrant.action}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {error ? (
          <p className="text-[12px] text-negative" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
