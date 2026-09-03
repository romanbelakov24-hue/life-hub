"use server";

import { revalidatePath } from "next/cache";

import { failure, guard, success, type ActionResult } from "@/lib/actions/types";
import { db } from "@/lib/db/client";
import { str } from "@/lib/db/rows";
import { isValidIso } from "@/lib/utils/date";
import { roundTo } from "@/lib/utils/format";
import { createId } from "@/lib/utils/id";

/**
 * Импорт трат из банковской выписки.
 *
 * Файл разбирается в браузере (см. lib/import/*), сюда приезжают уже готовые
 * строки. Так не нужен приём multipart и временные файлы, которых на
 * серверлес-хостинге всё равно нет.
 *
 * Повторный импорт того же файла безопасен: у каждой строки есть отпечаток
 * `import_key`, и уже записанные ключи отсеиваются до вставки.
 */

export interface ImportRow {
  date: string;
  categoryId: string;
  note: string;
  amount: number;
}

export interface ImportOutcome {
  /** Сколько трат добавлено. */
  added: number;
  /** Сколько пропущено как уже импортированные ранее. */
  duplicates: number;
}

/** Максимум строк за один импорт — защита от случайной загрузки годовой выписки. */
const MAX_ROWS = 2000;

/**
 * Отпечаток строки выписки.
 *
 * Складывается из даты, суммы и описания — этого достаточно, чтобы отличить
 * две разные покупки и узнать одну и ту же при повторной загрузке файла.
 * Описание нормализуется: банки меняют регистр и расстановку пробелов между
 * выгрузками, и без нормализации одна и та же операция дала бы разные ключи.
 */
function buildImportKey(row: ImportRow): string {
  const note = row.note.toLowerCase().replace(/\s+/g, " ").trim();
  return `${row.date}|${roundTo(row.amount, 2)}|${note}`;
}

export async function importExpenses(
  rows: ImportRow[],
): Promise<ActionResult<ImportOutcome>> {
  return guard(async () => {
    if (rows.length === 0) return failure("Нечего импортировать.");
    if (rows.length > MAX_ROWS) {
      return failure(`За один раз можно импортировать не больше ${MAX_ROWS} строк.`);
    }

    // Валидируем всё до записи: половина импорта хуже, чем понятный отказ.
    for (const row of rows) {
      if (!isValidIso(row.date)) return failure(`Неверная дата в строке: ${row.date}`);
      if (!row.categoryId) return failure("У некоторых строк не выбрана категория.");
      if (!Number.isFinite(row.amount) || row.amount <= 0) {
        return failure("Сумма должна быть больше нуля.");
      }
    }

    const client = await db();

    const withKeys = rows.map((row) => ({ row, key: buildImportKey(row) }));

    // Внутри самого файла тоже бывают дубли — например, если выписки за два
    // пересекающихся периода склеили в один файл.
    const uniqueByKey = new Map<string, ImportRow>();
    for (const { row, key } of withKeys) {
      if (!uniqueByKey.has(key)) uniqueByKey.set(key, row);
    }

    // Какие ключи уже есть в базе. Ограничиваемся диапазоном дат файла, чтобы
    // не вычитывать всю таблицу.
    const dates = rows.map((row) => row.date).sort();
    const existing = await client.execute({
      sql: `SELECT import_key FROM expenses
             WHERE import_key <> '' AND date BETWEEN ? AND ?`,
      args: [dates[0] ?? "", dates[dates.length - 1] ?? ""],
    });

    const alreadyImported = new Set(existing.rows.map((row) => str(row, "import_key")));

    const toInsert = [...uniqueByKey.entries()].filter(([key]) => !alreadyImported.has(key));
    const duplicates = uniqueByKey.size - toInsert.length;

    if (toInsert.length === 0) {
      return success({ added: 0, duplicates });
    }

    const now = new Date().toISOString();

    // Одним батчем: сотня отдельных вставок в базу другого региона заняла бы
    // десятки секунд.
    await client.batch(
      toInsert.map(([key, row]) => ({
        sql: `INSERT INTO expenses
                (id, date, category_id, note, amount, created_at, import_key)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          createId("exp"),
          row.date,
          row.categoryId,
          row.note.slice(0, 200),
          roundTo(row.amount, 2),
          now,
          key,
        ],
      })),
      "write",
    );

    revalidatePath("/expenses");
    revalidatePath("/");

    return success({ added: toInsert.length, duplicates });
  });
}
