/**
 * Разбор выписки в PDF.
 *
 * PDF не хранит таблиц — только буквы с координатами. Поэтому строки таблицы
 * приходится собирать заново: элементы группируются по вертикали в визуальные
 * строки, а строка считается началом новой операции, если она открывается
 * датой. Всё, что идёт без даты, — продолжение описания предыдущей операции,
 * которое банк перенёс по ширине колонки.
 *
 * Работает в браузере, как и разбор CSV: файл не покидает устройство.
 */

import type { Category } from "@/lib/types";
import { guessCategoryId } from "@/lib/utils/quick-parse";
import { parseStatementAmount, parseStatementDate, type StatementRow } from "./statement";

/** Один фрагмент текста с координатами на странице. */
interface TextItem {
  x: number;
  y: number;
  text: string;
}

/** Визуальная строка: фрагменты, оказавшиеся на одной высоте. */
interface VisualLine {
  y: number;
  items: TextItem[];
}

/** Дата в начале строки — признак новой операции. */
const LEADING_DATE = /^\d{2}\.\d{2}\.\d{4}$/;

/**
 * Достаёт текст из PDF, сохраняя раскладку по строкам.
 *
 * pdf.js грузится динамически: библиотека тяжёлая, и тащить её в общий бандл
 * ради страницы импорта, куда заходят раз в месяц, не стоит.
 */
export async function extractPdfLines(buffer: ArrayBuffer): Promise<VisualLine[][]> {
  const pdfjs = await import("pdfjs-dist");

  // Воркер лежит в public: так адрес не зависит от того, как сборщик
  // обработал бы new URL(..., import.meta.url).
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: VisualLine[][] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();

    const buckets = new Map<number, TextItem[]>();

    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;

      const x = item.transform[4] as number;
      const y = item.transform[5] as number;

      // Округление до 3pt склеивает фрагменты одной строки: буквы в PDF
      // нередко стоят на доли пункта выше или ниже соседних.
      const key = Math.round(y / 3) * 3;

      const bucket = buckets.get(key);
      const entry: TextItem = { x, y, text: item.str.trim() };
      if (bucket) bucket.push(entry);
      else buckets.set(key, [entry]);
    }

    pages.push(
      [...buckets.entries()]
        // Сверху вниз — порядок чтения страницы.
        .sort(([a], [b]) => b - a)
        .map(([y, items]) => ({ y, items: items.sort((a, b) => a.x - b.x) })),
    );
  }

  return pages;
}

/**
 * Операции, которые не являются тратами по сути: переводы между своими
 * счетами и снятие/пополнение. В сумму расходов они попадать не должны,
 * иначе месяц раздувается вдвое на одном переводе самому себе.
 */
const TRANSFER_MARKERS = [
  "перевод между своими",
  "перевод с карты на карту",
  "перевод на карту",
  "внесение наличных",
  "выдача наличных",
  "погашение",
];

function looksLikeTransfer(description: string): boolean {
  const text = description.toLowerCase();
  return TRANSFER_MARKERS.some((marker) => text.includes(marker));
}

/**
 * Достаёт из казённого описания то, что человек узнает.
 *
 * Банк пишет «Операция: ПОКУПКА (ВНЕШНЯЯ СЕТЬ РФ). Карта 2200****1844.
 * Устройство: BRATYA KARAVAEVY. Город: MOSCOW…». Полезное здесь — только
 * название точки после «Устройство:».
 */
export function extractMerchant(description: string): string {
  const device = description.match(/Устройство:\s*([^.]+)/i);
  if (device?.[1]) {
    return device[1]
      .replace(/\s+/g, " ")
      .replace(/\*+/g, " ")
      .trim();
  }

  // Перевод между счетами и подобное — берём начало описания без «Операция:».
  const cleaned = description.replace(/^Операция:\s*/i, "").split(".")[0] ?? description;
  return cleaned.replace(/\s+/g, " ").trim();
}

export interface PdfStatement {
  rows: StatementRow[];
  /** Сколько операций распознано как переводы и снято с отметки. */
  transfers: number;
}

/**
 * Собирает операции из страниц PDF.
 *
 * Суммы берутся из двух последних фрагментов строки — это колонки «Приход» и
 * «Расход». Ориентироваться на них надёжнее, чем на абсолютные координаты
 * колонок: те съезжают, если банк поменяет вёрстку или ширину полей.
 */
export function buildRowsFromPdf(
  pages: VisualLine[][],
  categories: Category[],
): PdfStatement {
  const rows: StatementRow[] = [];
  let transfers = 0;

  let current: { row: StatementRow; description: string } | null = null;
  let lineNumber = 0;

  const flush = () => {
    if (!current) return;

    const description = current.description;
    const merchant = extractMerchant(description);
    const isTransfer = looksLikeTransfer(description);

    if (isTransfer) transfers += 1;

    rows.push({
      ...current.row,
      description: merchant,
      // Переводы приезжают снятыми с отметки: формально это расход по счёту,
      // но не трата — деньги остались у владельца.
      isExpense: current.row.isExpense && !isTransfer,
    });

    current = null;
  };

  for (const page of pages) {
    for (const line of page) {
      lineNumber += 1;
      const items = line.items;
      if (items.length === 0) continue;

      const first = items[0]?.text ?? "";

      // Продолжение описания: строка без даты в начале.
      if (!LEADING_DATE.test(first)) {
        if (current) {
          current.description += ` ${items.map((item) => item.text).join(" ")}`;
        }
        continue;
      }

      flush();

      // Строка операции: дата, дата отражения, описание, приход, расход.
      if (items.length < 4) continue;

      const date = parseStatementDate(first);
      if (!date) continue;

      const credit = parseStatementAmount(items[items.length - 2]?.text ?? "");
      const debit = parseStatementAmount(items[items.length - 1]?.text ?? "");
      if (credit === null || debit === null) continue;

      // Расход в выписке уже со знаком минус; ноль означает, что операция
      // прошла по другой колонке.
      const amount = Math.abs(debit) > 0 ? Math.abs(debit) : Math.abs(credit);
      if (amount === 0) continue;

      const description = items
        .slice(2, items.length - 2)
        .map((item) => item.text)
        .join(" ");

      current = {
        description,
        row: {
          line: lineNumber,
          date,
          description,
          amount,
          bankCategory: "",
          categoryId: null,
          isExpense: Math.abs(debit) > 0,
        },
      };
    }
  }

  flush();

  // Категорию угадываем по уже очищенному названию точки — по «BRATYA
  // KARAVAEVY» толку больше, чем по «Операция: ПОКУПКА (ВНЕШНЯЯ СЕТЬ РФ)».
  return {
    rows: rows.map((row) => ({
      ...row,
      categoryId: guessCategoryId(row.description, categories),
    })),
    transfers,
  };
}
