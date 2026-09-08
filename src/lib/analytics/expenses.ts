/**
 * Аналитика расходов — чистые функции без обращений к базе.
 *
 * Почему отдельно от queries: считать проще и надёжнее в одном месте над уже
 * загруженным массивом трат за период, чем плодить SQL-агрегаты. Такие функции
 * легко читать, менять и покрывать тестами, а страницы остаются тонкими.
 */

import type {
  Category,
  CategoryBreakdownItem,
  CategoryBudgetStatus,
  ExpenseStats,
  ExpenseWithCategory,
  IsoDate,
  TrendPoint,
} from "@/lib/types";

import {
  daysOfMonth,
  formatDayMonthShort,
  formatMonthShort,
  formatWeekKey,
  weekKeyOf,
} from "@/lib/utils/date";
import { roundTo } from "@/lib/utils/format";

/** Категория вместе с покупками, которые в неё вошли. */
export type CategoryWithItems = CategoryBreakdownItem & {
  items: ExpenseWithCategory[];
};

/** Сумма трат в списке. */
export function sumExpenses(expenses: ExpenseWithCategory[]): number {
  return roundTo(
    expenses.reduce((total, expense) => total + expense.amount, 0),
    2,
  );
}

/**
 * Разбивка по категориям для донат-графика.
 * Отсортирована по убыванию суммы — первая позиция и есть «самая затратная».
 */
export function buildCategoryBreakdown(
  expenses: ExpenseWithCategory[],
): CategoryBreakdownItem[] {
  const buckets = new Map<string, CategoryBreakdownItem>();

  for (const expense of expenses) {
    const existing = buckets.get(expense.categoryId);

    if (existing) {
      existing.total = roundTo(existing.total + expense.amount, 2);
      existing.count += 1;
      continue;
    }

    buckets.set(expense.categoryId, {
      categoryId: expense.categoryId,
      name: expense.categoryName,
      color: expense.categoryColor,
      total: roundTo(expense.amount, 2),
      count: 1,
      share: 0,
    });
  }

  const total = sumExpenses(expenses);

  return [...buckets.values()]
    .map((item) => ({
      ...item,
      share: total > 0 ? roundTo((item.total / total) * 100, 1) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Траты по дням месяца. Дни без трат остаются в ряду с нулём —
 * иначе линия графика «схлопывается» и врёт про динамику.
 */
export function buildDailyTrend(
  expenses: ExpenseWithCategory[],
  monthAnchor: IsoDate,
): TrendPoint[] {
  const totals = new Map<string, number>();

  for (const expense of expenses) {
    totals.set(expense.date, roundTo((totals.get(expense.date) ?? 0) + expense.amount, 2));
  }

  return daysOfMonth(monthAnchor).map((day) => ({
    key: day,
    label: String(Number(day.slice(8, 10))),
    total: totals.get(day) ?? 0,
  }));
}

/** Траты по неделям внутри выбранного периода. */
export function buildWeeklyTrend(expenses: ExpenseWithCategory[]): TrendPoint[] {
  const totals = new Map<string, number>();

  for (const expense of expenses) {
    const key = weekKeyOf(expense.date);
    totals.set(key, roundTo((totals.get(key) ?? 0) + expense.amount, 2));
  }

  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, total]) => ({ key, label: formatWeekKey(key), total }));
}

/** Помесячные итоги -> точки графика сравнения месяцев. */
export function buildMonthlyTrend(
  monthlyTotals: Array<{ monthKey: string; total: number }>,
): TrendPoint[] {
  return monthlyTotals.map((item) => ({
    key: item.monthKey,
    label: formatMonthShort(item.monthKey),
    total: roundTo(item.total, 2),
  }));
}

/**
 * Сводная статистика периода.
 *
 * @param expenses     траты выбранного месяца
 * @param prevTotal    сумма трат предыдущего месяца (для тренда)
 * @param daysElapsed  сколько дней месяца уже прошло — по ним считается средний
 *                     расход в день. Для прошлых месяцев это длина месяца,
 *                     для текущего — число прошедших дней, иначе среднее
 *                     занижается остатком месяца.
 */
export function computeExpenseStats(
  expenses: ExpenseWithCategory[],
  prevTotal: number,
  daysElapsed: number,
): ExpenseStats {
  const total = sumExpenses(expenses);
  const transactionCount = expenses.length;
  const breakdown = buildCategoryBreakdown(expenses);

  const largestExpense =
    expenses.length > 0
      ? expenses.reduce((max, item) => (item.amount > max.amount ? item : max), expenses[0])
      : null;

  // Тренд считаем только когда есть база для сравнения: деление на ноль
  // даёт «бесконечный рост», что бессмысленно показывать пользователю.
  const monthOverMonthPercent =
    prevTotal > 0 ? roundTo(((total - prevTotal) / prevTotal) * 100, 1) : null;

  return {
    total,
    transactionCount,
    averageCheck: transactionCount > 0 ? roundTo(total / transactionCount, 2) : 0,
    averagePerDay: daysElapsed > 0 ? roundTo(total / daysElapsed, 2) : 0,
    topCategory: breakdown[0] ?? null,
    largestExpense,
    monthOverMonthPercent,
  };
}

/**
 * Разбивка по категориям вместе с самими покупками — для раскрывающегося
 * списка, где по клику видно, из чего сложилась сумма категории.
 *
 * Отдельная функция, а не поле в CategoryBreakdownItem: тому типу покупки не
 * нужны, он ездит в графики, и таскать за ним весь массив трат ради двух мест
 * было бы лишним весом на каждом рендере.
 *
 * Покупки внутри категории идут от новых к старым — так же, как в журнале.
 */
export function buildCategoryDetails(
  expenses: ExpenseWithCategory[],
): CategoryWithItems[] {
  const itemsByCategory = new Map<string, ExpenseWithCategory[]>();

  for (const expense of expenses) {
    const bucket = itemsByCategory.get(expense.categoryId);
    if (bucket) {
      bucket.push(expense);
    } else {
      itemsByCategory.set(expense.categoryId, [expense]);
    }
  }

  return buildCategoryBreakdown(expenses).map((category) => ({
    ...category,
    items: [...(itemsByCategory.get(category.categoryId) ?? [])].sort((a, b) =>
      a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date),
    ),
  }));
}

/** Группировка трат по дате — таблица рисует их днями с подзаголовками. */
export function groupExpensesByDate(
  expenses: ExpenseWithCategory[],
): Array<{ date: IsoDate; total: number; items: ExpenseWithCategory[] }> {
  const groups = new Map<IsoDate, ExpenseWithCategory[]>();

  for (const expense of expenses) {
    const bucket = groups.get(expense.date);
    if (bucket) {
      bucket.push(expense);
    } else {
      groups.set(expense.date, [expense]);
    }
  }

  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({
      date,
      total: sumExpenses(items),
      items,
    }));
}

/** Подпись точки дневного тренда для тултипа: "1 сен". */
export function dailyTrendTooltipLabel(key: string): string {
  return formatDayMonthShort(key);
}

/**
 * Категории с заданным лимитом — сколько уже потрачено и сколько осталось.
 *
 * Строится из всех категорий, а не из buildCategoryBreakdown: категория без
 * единой траты в этом месяце должна показать «0 из лимита», а не пропасть из
 * списка — иначе пользователь не увидит, что лимит вообще задан.
 *
 * Отсортировано по проценту использования — категории на грани перерасхода
 * (или уже в нём) видно первыми, без прокрутки.
 */
export function buildCategoryBudgets(
  categories: Category[],
  expenses: ExpenseWithCategory[],
): CategoryBudgetStatus[] {
  const spentByCategory = new Map<string, number>();
  for (const expense of expenses) {
    spentByCategory.set(
      expense.categoryId,
      roundTo((spentByCategory.get(expense.categoryId) ?? 0) + expense.amount, 2),
    );
  }

  return categories
    .filter((category): category is Category & { monthlyLimit: number } => category.monthlyLimit !== null)
    .map((category) => {
      const spent = spentByCategory.get(category.id) ?? 0;

      return {
        categoryId: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
        limit: category.monthlyLimit,
        spent,
        remaining: roundTo(category.monthlyLimit - spent, 2),
        percent: roundTo((spent / category.monthlyLimit) * 100, 0),
      };
    })
    .sort((a, b) => b.percent - a.percent);
}
