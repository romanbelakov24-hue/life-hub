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

// ─── Доходы и бюджет ─────────────────────────────────────────────────────────

export interface Income {
  id: string;
  date: IsoDate;
  /** Сумма в рублях. */
  amount: number;
  /** Откуда пришли деньги: стипендия, подработка, перевод от родителей. */
  source: string;
  createdAt: string;
}

/**
 * Прогноз бюджета на остаток месяца.
 *
 * Отвечает на один вопрос: сколько можно тратить в день, чтобы уложиться
 * в то, что пришло.
 */
export interface BudgetForecast {
  /** Доход, занесённый за этот месяц. */
  income: number;
  /** Уже потрачено. */
  spent: number;
  /** Доход минус траты; может быть отрицательным. */
  remaining: number;
  /** Дней до конца месяца, включая сегодняшний. */
  daysLeft: number;
  /** Сколько можно тратить в день, чтобы остатка хватило. null — дохода нет. */
  dailyAllowance: number | null;
  /** Средний расход в день в этом месяце. */
  currentDailyRate: number;
  /**
   * Средний расход в день за прошлые месяцы — по нему строится прогноз.
   * null, если истории ещё нет.
   */
  historicalDailyRate: number | null;
  /** Ожидаемая трата за месяц целиком при текущем темпе. */
  projectedTotal: number;
  /** Насколько прогноз разойдётся с доходом: минус — перерасход. */
  projectedBalance: number | null;
}

// ─── Здоровье ────────────────────────────────────────────────────────────────

/**
 * Одна строка = один день. Поля независимы: автоматизация «Быстрых команд»
 * может прислать только шаги, а через час — только сон, каждая обновит своё
 * поле, не затирая остальное. null — метрика за этот день не приходила.
 */
export interface HealthDaily {
  date: IsoDate;
  steps: number | null;
  sleepMinutes: number | null;
  restingHeartRate: number | null;
  updatedAt: string;
}

// ─── Раздел 2: учебный планер ────────────────────────────────────────────────

/**
 * Дело в календаре — на конкретную дату, не на день недели.
 * «Повторить по неделям» при создании — это несколько независимых строк с
 * разными датами (см. actions/events.ts), а не хранимое правило повторения:
 * ни этот тип, ни таблица в базе о нём не знают.
 */
export interface CalendarEvent {
  id: string;
  date: IsoDate;
  /** `HH:MM`; пусто — время не указано (дело на весь день). */
  startTime: string;
  endTime: string;
  title: string;
  location: string;
  description: string;
  color: string;
  createdAt: string;
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
