/**
 * Разбор CSV из банковских выписок.
 *
 * Пишем свой парсер, а не берём библиотеку, по двум причинам: нужен разбор
 * кодировки (российские банки массово выгружают в Windows-1251, а не в UTF-8)
 * и автоопределение разделителя, который у разных банков разный. Плюс
 * зависимость ради двухсот строк себя не окупает.
 *
 * Работает в браузере: файл читается на клиенте, на сервер уходят уже
 * разобранные строки. Так не нужен ни multipart-приём, ни временные файлы,
 * которых на серверлес-хостинге всё равно нет.
 */

/** Разделители, которые встречаются в выгрузках, в порядке проверки. */
const DELIMITERS = [";", ",", "\t"] as const;

export type Delimiter = (typeof DELIMITERS)[number];

/**
 * Декодирует файл в текст.
 *
 * Сначала пробуем UTF-8. Если в результате появился символ замены U+FFFD,
 * значит байты не были валидным UTF-8 — почти наверняка это Windows-1251,
 * стандартная кодировка выгрузок из российских банков.
 */
export function decodeFile(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  if (!utf8.includes("�")) return stripBom(utf8);

  try {
    return stripBom(new TextDecoder("windows-1251").decode(buffer));
  } catch {
    // Экзотический браузер без поддержки кодировки — отдаём как есть.
    return stripBom(utf8);
  }
}

/** Excel добавляет BOM в начало файла; в первой ячейке он лишний. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Определяет разделитель по первым строкам.
 *
 * Считаем не общее количество символов, а стабильность числа колонок: у
 * правильного разделителя строки бьются на одинаковое количество полей.
 * Простой подсчёт запятых ошибается на выписках, где запятая — десятичный
 * разделитель суммы.
 */
export function detectDelimiter(text: string): Delimiter {
  const lines = text.split(/\r?\n/).filter((line) => line.trim()).slice(0, 12);
  if (lines.length === 0) return ";";

  let best: Delimiter = ";";
  let bestScore = -1;

  for (const delimiter of DELIMITERS) {
    const counts = lines.map((line) => splitLine(line, delimiter).length);
    const columns = counts[0] ?? 1;

    // Разделитель, который не делит строку, не подходит.
    if (columns < 2) continue;

    const stable = counts.filter((count) => count === columns).length;
    // Больше колонок при той же стабильности — вероятнее верный разделитель.
    const score = stable * 100 + columns;

    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }

  return best;
}

/**
 * Разбивает одну строку с учётом кавычек.
 * Внутри кавычек разделитель — обычный символ, а удвоенная кавычка означает
 * саму кавычку (правило RFC 4180, его придерживаются все выгрузки).
 */
function splitLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current);
  return fields.map((field) => field.trim());
}

/**
 * Разбирает весь текст в таблицу.
 *
 * Переносы строк внутри кавычек — реальный случай: в назначении платежа
 * встречаются многострочные описания. Поэтому строки собираются посимвольно
 * с отслеживанием кавычек, а не простым split по \n.
 */
export function parseCsv(text: string, delimiter: Delimiter): string[][] {
  const rows: string[][] = [];
  let currentLine = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '"') {
      // Удвоенная кавычка внутри поля — экранированная: обе переносим как есть
      // и остаёмся внутри кавычек.
      if (inQuotes && text[index + 1] === '"') {
        currentLine += '""';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      // Кавычку обязательно дописываем: строку потом разбирает splitLine,
      // и без кавычек он снова примет разделитель внутри поля за границу.
      currentLine += char;
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      // \r\n — один перевод строки, а не два.
      if (char === "\r" && text[index + 1] === "\n") index += 1;

      if (currentLine.trim()) rows.push(splitLine(currentLine, delimiter));
      currentLine = "";
      continue;
    }

    currentLine += char;
  }

  if (currentLine.trim()) rows.push(splitLine(currentLine, delimiter));

  return rows;
}
