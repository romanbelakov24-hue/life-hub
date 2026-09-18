import type { CalendarEvent, ExpenseWithCategory, Note, Task } from "@/lib/types";

/**
 * Контракт API агента: как сущности life hub выглядят снаружи.
 *
 * Имена полей — те, под которые уже написан адаптер KAIROS
 * (kairos/core/src/lifehub.mjs и сценарий «Захват задачи»): title, due, note,
 * priority. Внутренние имена (dueDate, description, urgent/important) наружу
 * не торчат — переименование колонки в базе не должно ломать агента.
 *
 * Поля без значения отдаются как null, а не пустой строкой: для агента «срока
 * нет» и «срок — пустая строка» не должны выглядеть по-разному.
 */

export const AGENT_API_VERSION = "1.0.0";

// ─── Приоритет ───────────────────────────────────────────────────────────────

/**
 * Приоритеты KAIROS — из его промпта захвата задачи:
 * P1 — явная срочность или срок в пределах суток, P2 — обычное дело со сроком,
 * P3 — «когда-нибудь». В life hub задачи живут в матрице Эйзенхауэра: четыре
 * квадранта на три приоритета, так что круг «флаги → P → флаги» НЕ без потерь —
 * «срочно, но не важно» уходит агенту как P1, а P1 обратно — это «срочно и
 * важно». Поэтому при обновлении задачи флаги пересчитываются только если
 * приоритет действительно сменился (applyPriority).
 */
export type Priority = "P1" | "P2" | "P3";

export function isPriority(value: unknown): value is Priority {
  return value === "P1" || value === "P2" || value === "P3";
}

export function priorityToFlags(priority: Priority): { urgent: boolean; important: boolean } {
  if (priority === "P1") return { urgent: true, important: true };
  if (priority === "P2") return { urgent: false, important: true };
  return { urgent: false, important: false };
}

/** Срочное без важности («делегировать») тоже P1: для агента главное, что оно горит. */
export function flagsToPriority(urgent: boolean, important: boolean): Priority {
  if (urgent) return "P1";
  if (important) return "P2";
  return "P3";
}

type PriorityFlags = { urgent: boolean; important: boolean };

/**
 * Флаги задачи после того, как агент прислал приоритет. Если это тот же
 * приоритет, что задача уже отдаёт наружу, — флаги не трогаем: агент часто
 * отправляет прочитанное обратно, и задача не должна переезжать между
 * квадрантами из-за того, что у приоритета меньше значений, чем у матрицы.
 */
export function applyPriority(current: PriorityFlags, priority: Priority | undefined): PriorityFlags {
  if (priority === undefined || flagsToPriority(current.urgent, current.important) === priority) {
    return { urgent: current.urgent, important: current.important };
  }
  return priorityToFlags(priority);
}

// ─── Сериализация ────────────────────────────────────────────────────────────

const orNull = (value: string): string | null => (value === "" ? null : value);

export function serializeTask(task: Task) {
  return {
    id: task.id,
    title: task.title,
    note: orNull(task.description),
    due: orNull(task.dueDate),
    done: task.done,
    priority: flagsToPriority(task.urgent, task.important),
    urgent: task.urgent,
    important: task.important,
    subject: orNull(task.subject),
    createdAt: task.createdAt,
    completedAt: task.completedAt,
  };
}

export function serializeExpense(expense: ExpenseWithCategory) {
  return {
    id: expense.id,
    date: expense.date,
    amount: expense.amount,
    category: expense.categoryName,
    categoryId: expense.categoryId,
    note: orNull(expense.note),
    createdAt: expense.createdAt,
  };
}

export function serializeEvent(event: CalendarEvent) {
  return {
    id: event.id,
    date: event.date,
    start: orNull(event.startTime),
    end: orNull(event.endTime),
    title: event.title,
    location: orNull(event.location),
    description: orNull(event.description),
    createdAt: event.createdAt,
  };
}

export function serializeNote(note: Note) {
  return {
    id: note.id,
    title: orNull(note.title),
    body: note.body,
    date: note.date,
    subject: orNull(note.subject),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}
