/**
 * Доменные типы приложения.
 * Одно место правды: и запросы к БД, и серверные действия, и компоненты
 * используют именно эти типы. Меняешь схему в src/lib/db/schema.ts —
 * поправь и здесь.
 */

// ─── Общее ────────────────────────────────────────────────────────────────────

/** Дата в формате ISO `YYYY-MM-DD` (без времени и таймзоны). */
export type IsoDate = string;

/** День недели: 1 — понедельник … 7 — воскресенье (стандарт ISO-8601). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// ─── Раздел 1: расходы ───────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  /** HEX-цвет для графиков и меток, например `#d9451c`. */
  color: string;
  /** Ключ иконки из src/config/icons.ts. */
  icon: string;
  /** Базовые категории нельзя удалить — только переименовать. */
  isDefault: boolean;
  /** Порядок отображения в списках и чипсах. */
  sortOrder: number;
}

export interface Expense {
  id: string;
  date: IsoDate;
  categoryId: string;
  note: string;
  /** Сумма в рублях. Храним числом с плавающей точкой (копейки поддерживаются). */
  amount: number;
  createdAt: string;
}

/** Трата вместе с раскрытой категорией — то, что реально рендерит таблица. */
export interface ExpenseWithCategory extends Expense {
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
}

/** Итоги за период — карточки «сегодня / неделя / месяц». */
export interface PeriodTotals {
  today: number;
  week: number;
  month: number;
  /** Предыдущий месяц — нужен для стрелки тренда. */
  prevMonth: number;
}

/** Строка донат-графика «расходы по категориям». */
export interface CategoryBreakdownItem {
  categoryId: string;
  name: string;
  color: string;
  total: number;
  count: number;
  /** Доля от общей суммы за период, 0…100. */
  share: number;
}

/** Точка графика динамики трат. */
export interface TrendPoint {
  /** Ключ периода: `YYYY-MM-DD` для дней, `YYYY-Www` для недель, `YYYY-MM` для месяцев. */
  key: string;
  /** Человекочитаемая подпись оси X. */
  label: string;
  total: number;
}

export type TrendGranularity = "day" | "week" | "month";

/** Сводная статистика раздела расходов. */
export interface ExpenseStats {
  /** Средний чек — сумма / количество трат за период. */
  averageCheck: number;
  /** Средние траты в день за период. */
  averagePerDay: number;
  transactionCount: number;
  total: number;
  /** Самая затратная категория периода (null, если трат нет). */
  topCategory: CategoryBreakdownItem | null;
  /** Самая крупная разовая трата. */
  largestExpense: ExpenseWithCategory | null;
  /** Изменение к предыдущему месяцу в процентах (null, если сравнивать не с чем). */
  monthOverMonthPercent: number | null;
}

// ─── Раздел 2: учебный планер ────────────────────────────────────────────────

/** Одна пара в сетке расписания. */
export interface ScheduleSlot {
  id: string;
  weekday: Weekday;
  /** Номер пары, 1…8. Время по умолчанию берётся из src/config/schedule.ts. */
  pairIndex: number;
  subject: string;
  room: string;
  teacher: string;
  /** Время начала `HH:MM`; пусто — используется дефолт для номера пары. */
  startTime: string;
  endTime: string;
  color: string;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  date: IsoDate;
  /** Название предмета, к которому привязана заметка. Пусто — общая заметка. */
  subject: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  /** Дедлайн; пусто — без срока. */
  dueDate: IsoDate | "";
  done: boolean;
  /** Ось «срочно» матрицы Эйзенхауэра. */
  urgent: boolean;
  /** Ось «важно» матрицы Эйзенхауэра. */
  important: boolean;
  subject: string;
  createdAt: string;
  completedAt: string | null;
}

/** Квадрант матрицы Эйзенхауэра, вычисляется из флагов urgent/important. */
export type Quadrant = "do" | "plan" | "delegate" | "drop";
