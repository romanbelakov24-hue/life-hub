/**
 * Форматирование чисел и сумм.
 *
 * Специально НЕ используем Intl.NumberFormat: он даёт разные пробелы-разделители
 * в Node и в браузере, что React ловит как ошибку гидрации. Здесь всё
 * детерминировано и одинаково на сервере и на клиенте.
 */

/** Неразрывный пробел — разделитель разрядов. */
const NBSP = " ";

/** Округление до N знаков без артефактов плавающей точки. */
export function roundTo(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** 1234567.5 -> "1 234 567,5" */
export function formatNumber(value: number, maxFractionDigits = 2): string {
  const safe = Number.isFinite(value) ? value : 0;
  const rounded = roundTo(safe, maxFractionDigits);
  const isNegative = rounded < 0;

  const [intPart, fracPart = ""] = Math.abs(rounded)
    .toFixed(maxFractionDigits)
    .split(".");

  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const trimmedFrac = fracPart.replace(/0+$/, "");

  return `${isNegative ? "-" : ""}${grouped}${trimmedFrac ? `,${trimmedFrac}` : ""}`;
}

/** 1200 -> "1 200 ₽" */
export function formatRub(value: number, maxFractionDigits = 2): string {
  return `${formatNumber(value, maxFractionDigits)}${NBSP}₽`;
}

/** Компактный формат для осей графиков: 12500 -> "12,5к", 1250000 -> "1,25М" */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${formatNumber(value / 1_000_000, 2)}М`;
  if (abs >= 1_000) return `${formatNumber(value / 1_000, 1)}к`;
  return formatNumber(value, 0);
}

/** 12.345 -> "+12,3 %" (знак всегда явный — используется для трендов). */
export function formatSignedPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, 1)}${NBSP}%`;
}

/**
 * Разбирает пользовательский ввод суммы: "1 200,50", "1200.5", "400р" -> число.
 * Возвращает null, если распознать не удалось.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input
    .replace(/[₽]/g, "")
    .replace(/[рp]/gi, "")
    .replace(/\s/g, "")
    .replace(NBSP, "")
    .replace(",", ".")
    .trim();

  if (!cleaned) return null;

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return roundTo(parsed, 2);
}

/** Склонение: pluralize(5, "трата", "траты", "трат") -> "трат" */
export function pluralize(count: number, one: string, few: string, many: string): string {
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;

  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
