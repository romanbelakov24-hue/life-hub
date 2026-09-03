/**
 * Разбор банковской выписки: поиск колонок, чтение дат и сумм.
 *
 * Единый разбор вместо четырёх парсеров под конкретные банки. Форматы выгрузок
 * меняются от версии к версии приложения банка, и жёсткая привязка к колонкам
 * ломалась бы на каждом обновлении. Здесь колонки ищутся по названиям в шапке,
 * а если не нашлись — пользователь указывает их сам в интерфейсе.
 */

import type { Category } from "@/lib/types";
import { guessCategoryId } from "@/lib/utils/quick-parse";

/** Роли колонок, которые нужны для импорта. */
export type ColumnRole = "date" | "amount" | "description" | "category";

/** Индексы колонок в таблице; -1 означает «не найдено». */
export type ColumnMap = Record<ColumnRole, number>;

/**
 * Слова в шапке, по которым угадывается роль колонки.
 * Проверяются по вхождению, порядок важен: более точные варианты выше.
 */
const HEADER_HINTS: Record<ColumnRole, string[]> = {
  // «Дата операции» важнее «даты платежа»: списание могло пройти позже покупки.
  date: ["дата операции", "дата транзакции", "дата", "date"],
  // «Сумма операции» — в валюте покупки, «сумма платежа» — в валюте счёта.
  amount: ["сумма операции", "сумма платежа", "сумма", "amount", "приход", "расход"],
  description: [
    "описание",
    "назначение",
    "детали",
    "комментарий",
    "контрагент",
    "получатель",
    "merchant",
    "description",
  ],
  category: ["категория", "category"],
};

/** Строка выписки после разбора. */
export interface StatementRow {
  /** Номер строки в файле — показываем в предпросмотре при ошибках. */
  line: number;
  date: string;
  description: string;
  /** Модуль суммы; знак уже учтён при отборе. */
  amount: number;
  /** Категория из выписки, если банк её указал. */
  bankCategory: string;
  /** Угаданная категория приложения; null — не определилась. */
  categoryId: string | null;
  /** Списание (иначе — поступление или перевод себе). */
  isExpense: boolean;
}

/** Итог разбора файла. */
export interface ParsedStatement {
  headers: string[];
  columns: ColumnMap;
  rows: StatementRow[];
  /** Строки, которые не удалось разобрать, — показываем числом. */
  skipped: number;
}

/**
 * Ищет строку-шапку.
 *
 * Выписки часто начинаются с шапки отчёта: название банка, номер счёта, период.
 * Настоящая шапка таблицы — первая строка, где хотя бы три непустые ячейки
 * и находится колонка с датой.
 */
export function findHeaderRow(rows: string[][]): number {
  for (let index = 0; index < Math.min(rows.length, 25); index += 1) {
    const row = rows[index];
    if (!row) continue;

    const filled = row.filter((cell) => cell.trim()).length;
    if (filled < 3) continue;

    const map = detectColumns(row);
    if (map.date >= 0 && map.amount >= 0) return index;
  }

  return 0;
}

/** Сопоставляет названия колонок с ролями. */
export function detectColumns(headers: string[]): ColumnMap {
  const normalized = headers.map((header) => header.toLowerCase().trim());
  const map: ColumnMap = { date: -1, amount: -1, description: -1, category: -1 };

  for (const [role, hints] of Object.entries(HEADER_HINTS) as [ColumnRole, string[]][]) {
    for (const hint of hints) {
      const index = normalized.findIndex((header) => header.includes(hint));
      if (index >= 0) {
        map[role] = index;
        break;
      }
    }
  }

  return map;
}

/**
 * Читает дату в форматах, которые встречаются в выписках.
 * Возвращает `YYYY-MM-DD` или null.
 */
export function parseStatementDate(value: string): string | null {
  const text = value.trim();
  if (!text) return null;

  // 01.09.2026 или 01.09.2026 14:30:00 — самый частый формат
  const dotted = text.match(/^(\d{2})[.\-/](\d{2})[.\-/](\d{4})/);
  if (dotted) return `${dotted[3]}-${dotted[2]}-${dotted[1]}`;

  // 2026-09-01 или 2026/09/01
  const iso = text.match(/^(\d{4})[.\-/](\d{2})[.\-/](\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // 01.09.26 — двузначный год
  const shortYear = text.match(/^(\d{2})[.\-/](\d{2})[.\-/](\d{2})(?!\d)/);
  if (shortYear) return `20${shortYear[3]}-${shortYear[2]}-${shortYear[1]}`;

  return null;
}

/**
 * Читает сумму: «-1 200,00», «1200.50», «−450,00 ₽».
 *
 * Возвращает число со знаком: минус означает списание. Знак важен, по нему
 * отделяются траты от поступлений.
 */
export function parseStatementAmount(value: string): number | null {
  const text = value.trim();
  if (!text) return null;

  // Минус бывает типографским (U+2212), а скобками банки помечают списание.
  const isNegative = /^[-−]/.test(text) || /^\(.*\)$/.test(text);

  const cleaned = text
    .replace(/[()]/g, "")
    .replace(/[−-]/g, "")
    .replace(/[^\d.,]/g, "")
    .trim();

  if (!cleaned) return null;

  // Определяем десятичный разделитель по последнему знаку: у «1.234,56» это
  // запятая, у «1,234.56» — точка. Разделитель тысяч затем убираем.
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  let normalized: string;
  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = cleaned.replace(/,/g, "");
  } else {
    normalized = cleaned;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;

  return isNegative ? -parsed : parsed;
}

/**
 * Собирает строки выписки.
 *
 * @param treatAllAsExpense  для выгрузок, где списания идут без минуса
 *                           (отдельная выгрузка «расходы»).
 */
export function buildStatementRows(
  table: string[][],
  headerIndex: number,
  columns: ColumnMap,
  categories: Category[],
  treatAllAsExpense: boolean,
): ParsedStatement {
  const headers = table[headerIndex] ?? [];
  const rows: StatementRow[] = [];
  let skipped = 0;

  for (let index = headerIndex + 1; index < table.length; index += 1) {
    const row = table[index];
    if (!row) continue;

    const date = parseStatementDate(row[columns.date] ?? "");
    const rawAmount = parseStatementAmount(row[columns.amount] ?? "");

    // Строка без даты или суммы — это подвал отчёта или итоговая строка.
    if (!date || rawAmount === null || rawAmount === 0) {
      skipped += 1;
      continue;
    }

    const description = (row[columns.description] ?? "").trim();
    const bankCategory = columns.category >= 0 ? (row[columns.category] ?? "").trim() : "";

    // Категорию ищем сначала по названию из банка, потом по описанию: у банка
    // она обычно точнее, чем догадка по строке вроде «SBOL P2P».
    const categoryId =
      guessCategoryId(bankCategory, categories) ?? guessCategoryId(description, categories);

    rows.push({
      line: index + 1,
      date,
      description,
      amount: Math.abs(rawAmount),
      bankCategory,
      categoryId,
      isExpense: treatAllAsExpense || rawAmount < 0,
    });
  }

  return { headers, columns, rows, skipped };
}
