/**
 * Разбор строки быстрого добавления траты.
 *
 * Поддерживаются варианты записи, которыми удобно печатать с телефона:
 *   "Магазин — 1200"      -> заметка "Магазин", 1200 ₽, категория «Магазин»
 *   "Кофе 400р"           -> заметка "Кофе",    400 ₽,  категория «Еда»
 *   "1250,50 продукты"    -> заметка "продукты", 1250.5 ₽, категория «Магазин»
 *   "500"                 -> только сумма, категорию выбирает пользователь
 */

import type { Category } from "@/lib/types";
import { parseAmount } from "@/lib/utils/format";

export interface QuickParseResult {
  /** Распознанная сумма или null, если числа в строке нет. */
  amount: number | null;
  /** Остаток строки — уходит в поле «заметка». */
  note: string;
  /** Угаданная категория или null, если совпадений не нашлось. */
  categoryId: string | null;
}

/**
 * Словарь подсказок: слово в строке -> к какой базовой категории оно относится.
 * Ключи сравниваются по началу слова, поэтому "продукт" ловит и "продукты".
 * Дополняй под свои привычки — это самая частая правка в файле.
 */
const KEYWORD_HINTS: Record<string, string[]> = {
  cat_groceries: ["магаз", "продукт", "пятёр", "пятер", "магнит", "перекрёст", "перекрест", "лента", "ашан", "вкусвилл"],
  cat_food: ["кофе", "еда", "обед", "завтрак", "ужин", "кафе", "столов", "шаурм", "пицц", "бургер", "чай", "перекус", "ресторан", "доставк"],
  cat_transport: ["метро", "автобус", "трамвай", "такси", "проезд", "бензин", "самокат", "electric", "троллейб", "электричк", "билет"],
  cat_study: ["учеб", "учёб", "книг", "тетрад", "курс", "печат", "распечат", "канцеляр", "ручк", "универ"],
  cat_fun: ["кино", "игр", "концерт", "бар", "подписк", "музык", "театр", "клуб", "развлеч"],
};

/** Число в строке: целое или дробное, с запятой или точкой. */
const AMOUNT_PATTERN = /(\d+(?:[.,]\d{1,2})?)(?=\s*(?:₽|руб|р\b|p\b)?)/gi;

export function parseQuickEntry(input: string, categories: Category[]): QuickParseResult {
  const raw = input.trim();
  if (!raw) return { amount: null, note: "", categoryId: null };

  // Берём последнее число в строке: в "Кофе 2 шт 400" суммой будет 400.
  const matches = [...raw.matchAll(AMOUNT_PATTERN)];
  const lastMatch = matches.at(-1);

  const amount = lastMatch ? parseAmount(lastMatch[1] ?? "") : null;

  // Заметка — строка без найденного числа и без разделителей-тире.
  const note = (
    lastMatch
      ? raw.slice(0, lastMatch.index) + raw.slice((lastMatch.index ?? 0) + lastMatch[0].length)
      : raw
  )
    .replace(/[₽]|руб\.?|\bр\b|\bp\b/gi, "")
    .replace(/[—–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    amount,
    note,
    categoryId: guessCategoryId(note, categories),
  };
}

/**
 * Угадывает категорию по тексту заметки.
 * Сначала пробуем прямое совпадение с названием категории (в том числе
 * пользовательской), потом — словарь подсказок для базовых категорий.
 */
export function guessCategoryId(note: string, categories: Category[]): string | null {
  const haystack = note.toLowerCase();
  if (!haystack) return null;

  // 1) Название категории целиком встречается в тексте.
  const byName = categories.find((category) => {
    const name = category.name.toLowerCase();
    return name.length >= 3 && haystack.includes(name);
  });
  if (byName) return byName.id;

  // 2) Ключевое слово из словаря — только для существующих категорий.
  for (const [categoryId, keywords] of Object.entries(KEYWORD_HINTS)) {
    if (!categories.some((category) => category.id === categoryId)) continue;
    if (keywords.some((keyword) => haystack.includes(keyword))) return categoryId;
  }

  return null;
}
