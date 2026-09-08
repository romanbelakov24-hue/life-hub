/**
 * Безопасное чтение значений из строк libSQL.
 *
 * Драйвер отдаёт `Row` как набор `string | number | bigint | ArrayBuffer | null`,
 * поэтому каждое поле приводим к нужному типу явно — иначе TypeScript в строгом
 * режиме будет ругаться в каждом маппере, а bigint из SQLite молча сломает
 * арифметику.
 */

import type { Row } from "@libsql/client";

/** Значение колонки как строка; null/undefined -> "". */
export function str(row: Row, key: string): string {
  const value = row[key];
  if (value === null || value === undefined) return "";
  if (value instanceof ArrayBuffer) return "";
  return String(value);
}

/** Значение колонки как число; всё нечисловое -> fallback. */
export function num(row: Row, key: string, fallback = 0): number {
  const value = row[key];
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

/** SQLite хранит булевы значения как 0/1. */
export function bool(row: Row, key: string): boolean {
  return num(row, key, 0) === 1;
}

/** Строка или null — для колонок вроде completed_at. */
export function strOrNull(row: Row, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined || value === "") return null;
  return str(row, key);
}

/**
 * Число или null — для колонок, где NULL значит «не задано», а не ноль
 * (лимит категории, показатели здоровья). num() тут не подходит: у ннего
 * нечисловое значение тоже превращается в 0, и «лимита нет» стало бы
 * неотличимо от «лимит — 0 рублей».
 */
export function numOrNull(row: Row, key: string): number | null {
  const value = row[key];
  return value === null || value === undefined ? null : num(row, key);
}
