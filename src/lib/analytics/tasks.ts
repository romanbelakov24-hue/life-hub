/**
 * Логика задач: матрица Эйзенхауэра и группировка по срокам.
 * Чистые функции — используются и на сервере (страницы), и на клиенте (виджеты).
 */

import type { IsoDate, Quadrant, Task } from "@/lib/types";
import { daysBetween } from "@/lib/utils/date";

/** Описание квадрантов матрицы: порядок, подписи, семантика цвета. */
export interface QuadrantMeta {
  id: Quadrant;
  title: string;
  /** Что делать с задачами этого квадранта. */
  action: string;
  urgent: boolean;
  important: boolean;
  /** CSS-переменная темы, а не хардкод цвета — работает в обеих темах. */
  accentVar: string;
}

export const QUADRANTS: QuadrantMeta[] = [
  {
    id: "do",
    title: "Срочно и важно",
    action: "Делать сейчас",
    urgent: true,
    important: true,
    accentVar: "var(--accent)",
  },
  {
    id: "plan",
    title: "Важно, не срочно",
    action: "Запланировать",
    urgent: false,
    important: true,
    accentVar: "var(--positive)",
  },
  {
    id: "delegate",
    title: "Срочно, не важно",
    action: "Сделать быстро или делегировать",
    urgent: true,
    important: false,
    accentVar: "var(--warning)",
  },
  {
    id: "drop",
    title: "Не срочно и не важно",
    action: "Отложить или убрать",
    urgent: false,
    important: false,
    accentVar: "var(--ink-faint)",
  },
];

/** Квадрант вычисляется из двух флагов — отдельного поля в базе не держим. */
export function quadrantOf(task: Pick<Task, "urgent" | "important">): Quadrant {
  if (task.urgent && task.important) return "do";
  if (!task.urgent && task.important) return "plan";
  if (task.urgent && !task.important) return "delegate";
  return "drop";
}

/** Раскладывает задачи по четырём квадрантам с сохранением исходного порядка. */
export function groupTasksByQuadrant(tasks: Task[]): Record<Quadrant, Task[]> {
  const groups: Record<Quadrant, Task[]> = { do: [], plan: [], delegate: [], drop: [] };

  for (const task of tasks) {
    groups[quadrantOf(task)].push(task);
  }

  return groups;
}

// ─── Группировка по срокам (обычный список задач) ────────────────────────────

export type DueBucket = "overdue" | "today" | "tomorrow" | "week" | "later" | "someday";

export const DUE_BUCKET_LABELS: Record<DueBucket, string> = {
  overdue: "Просрочено",
  today: "Сегодня",
  tomorrow: "Завтра",
  week: "На этой неделе",
  later: "Позже",
  someday: "Без срока",
};

/** Порядок групп в списке — от самого горящего к необязательному. */
export const DUE_BUCKET_ORDER: DueBucket[] = [
  "overdue",
  "today",
  "tomorrow",
  "week",
  "later",
  "someday",
];

export function dueBucketOf(task: Task, today: IsoDate): DueBucket {
  if (!task.dueDate) return "someday";

  const diff = daysBetween(today, task.dueDate);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 7) return "week";
  return "later";
}

/**
 * Активные задачи по группам сроков.
 * Выполненные исключаются: у них дедлайн уже не имеет значения,
 * они показываются отдельным блоком «Выполнено».
 */
export function groupTasksByDue(
  tasks: Task[],
  today: IsoDate,
): Array<{ bucket: DueBucket; label: string; items: Task[] }> {
  const groups = new Map<DueBucket, Task[]>();

  for (const task of tasks) {
    if (task.done) continue;

    const bucket = dueBucketOf(task, today);
    const items = groups.get(bucket);
    if (items) {
      items.push(task);
    } else {
      groups.set(bucket, [task]);
    }
  }

  return DUE_BUCKET_ORDER.filter((bucket) => groups.has(bucket)).map((bucket) => ({
    bucket,
    label: DUE_BUCKET_LABELS[bucket],
    items: groups.get(bucket) ?? [],
  }));
}

/** Просрочена ли задача на текущую дату. */
export function isOverdue(task: Task, today: IsoDate): boolean {
  return !task.done && task.dueDate !== "" && daysBetween(today, task.dueDate) < 0;
}
