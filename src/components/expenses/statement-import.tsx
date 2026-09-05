"use client";

import { AlertTriangle, CalendarX, Check, FileUp, Loader2, Upload } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, Select, TextInput } from "@/components/ui/field";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { importExpenses, type ImportOutcome } from "@/lib/actions/import";
import { decodeFile, detectDelimiter, parseCsv } from "@/lib/import/csv";
import { buildRowsFromPdf, extractPdfLines } from "@/lib/import/pdf";
import {
  buildStatementRows,
  detectColumns,
  findHeaderRow,
  type ColumnMap,
  type ColumnRole,
  type ParsedStatement,
} from "@/lib/import/statement";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { formatDayMonthShort } from "@/lib/utils/date";
import { formatRub, pluralize } from "@/lib/utils/format";

/**
 * Импорт трат из банковской выписки.
 *
 * Файл разбирается целиком в браузере: на сервер уезжают уже готовые строки.
 * Так не нужен приём файлов на серверлес-хостинге, а пользователь видит
 * результат разбора до того, как что-то попадёт в базу.
 *
 * Автоопределение колонок работает не на всех выгрузках, поэтому три
 * ключевые колонки всегда можно переназначить руками — это спасает от
 * ситуации «банк поменял формат, импорт больше не работает».
 */

interface StatementImportProps {
  categories: Category[];
}

/** Что нужно знать о строке сверх разбора: включена ли и какая у неё категория. */
interface RowState {
  excluded: boolean;
  categoryId: string;
}

export function StatementImport({ categories }: StatementImportProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [table, setTable] = useState<string[][] | null>(null);
  // Разбор PDF готов сразу: колонок и шапки у него нет, настраивать нечего.
  const [pdfParsed, setPdfParsed] = useState<ParsedStatement | null>(null);
  const [transfersFound, setTransfersFound] = useState(0);
  const [isReading, setIsReading] = useState(false);
  const [headerIndex, setHeaderIndex] = useState(0);
  const [columns, setColumns] = useState<ColumnMap>({
    date: -1,
    amount: -1,
    description: -1,
    category: -1,
  });
  const [treatAllAsExpense, setTreatAllAsExpense] = useState(false);
  // Нижняя граница периода: в выписке часто есть операции, уже занесённые
  // раньше руками, и переносить их заново незачем.
  const [fromDate, setFromDate] = useState("");
  const [rowStates, setRowStates] = useState<Record<number, RowState>>({});
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [isPending, startTransition] = useTransition();

  const inputRef = useRef<HTMLInputElement>(null);

  // «Другое» — запасная категория для строк, которые не удалось угадать.
  const fallbackCategoryId =
    categories.find((category) => category.id === "cat_other")?.id ??
    categories[0]?.id ??
    "";

  const parsed = useMemo(() => {
    if (pdfParsed) return pdfParsed;
    if (!table || columns.date < 0 || columns.amount < 0) return null;
    return buildStatementRows(table, headerIndex, columns, categories, treatAllAsExpense);
  }, [pdfParsed, table, headerIndex, columns, categories, treatAllAsExpense]);

  const allExpenseRows = useMemo(
    () => parsed?.rows.filter((row) => row.isExpense) ?? [],
    [parsed],
  );

  // Даты в формате YYYY-MM-DD сравниваются как строки — отдельный разбор
  // в Date здесь не нужен.
  const expenseRows = useMemo(
    () => (fromDate ? allExpenseRows.filter((row) => row.date >= fromDate) : allExpenseRows),
    [allExpenseRows, fromDate],
  );

  const hiddenByDate = allExpenseRows.length - expenseRows.length;
  const incomeCount = (parsed?.rows.length ?? 0) - allExpenseRows.length;

  /** Самая ранняя операция в файле — подсказка, с чего начинается выписка. */
  const earliestDate = useMemo(
    () => allExpenseRows.reduce<string | null>(
      (min, row) => (min === null || row.date < min ? row.date : min),
      null,
    ),
    [allExpenseRows],
  );

  /** Категория строки: ручной выбор -> угаданная -> запасная. */
  function categoryFor(line: number, guessed: string | null): string {
    return rowStates[line]?.categoryId ?? guessed ?? fallbackCategoryId;
  }

  const selectedRows = expenseRows.filter((row) => !rowStates[row.line]?.excluded);

  async function handleFile(file: File) {
    setError(null);
    setOutcome(null);
    setRowStates({});
    setFileName(file.name);
    setTable(null);
    setPdfParsed(null);
    setTransfersFound(0);

    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (isPdf) {
      await handlePdf(file);
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const text = decodeFile(buffer);
      const delimiter = detectDelimiter(text);
      const nextTable = parseCsv(text, delimiter);

      if (nextTable.length < 2) {
        setError("В файле не нашлось таблицы. Проверьте, что это выгрузка в CSV.");
        setTable(null);
        return;
      }

      const nextHeaderIndex = findHeaderRow(nextTable);
      const nextColumns = detectColumns(nextTable[nextHeaderIndex] ?? []);

      setTable(nextTable);
      setHeaderIndex(nextHeaderIndex);
      setColumns(nextColumns);

      if (nextColumns.date < 0 || nextColumns.amount < 0) {
        setError("Не удалось определить колонки с датой и суммой — укажите их вручную.");
      }
    } catch {
      setError("Не удалось прочитать файл.");
      setTable(null);
    }
  }

  /**
   * PDF разбирается иначе: таблицы в нём нет, строки собираются по координатам
   * текста (см. lib/import/pdf.ts). Настраивать колонки не нужно и нечего,
   * поэтому шаг с колонками для PDF не показывается.
   */
  async function handlePdf(file: File) {
    setIsReading(true);

    try {
      const buffer = await file.arrayBuffer();
      const pages = await extractPdfLines(buffer);
      const { rows, transfers } = buildRowsFromPdf(pages, categories);

      if (rows.length === 0) {
        setError(
          "В PDF не нашлось операций. Возможно, это скан: у него нет текстового слоя, и вытащить строки невозможно.",
        );
        return;
      }

      setPdfParsed({
        headers: [],
        columns: { date: -1, amount: -1, description: -1, category: -1 },
        rows,
        skipped: 0,
      });
      setTransfersFound(transfers);
    } catch {
      setError("Не удалось прочитать PDF.");
    } finally {
      setIsReading(false);
    }
  }

  function handleImport() {
    setError(null);

    const payload = selectedRows.map((row) => ({
      date: row.date,
      categoryId: categoryFor(row.line, row.categoryId),
      note: row.description || row.bankCategory || "Импорт из выписки",
      amount: row.amount,
    }));

    startTransition(async () => {
      const result = await importExpenses(payload);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setOutcome(result.data);
      setTable(null);
      setPdfParsed(null);
      setTransfersFound(0);
      setFileName(null);
      setRowStates({});
    });
  }

  const headers = parsed?.headers ?? table?.[headerIndex] ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Выбор файла ────────────────────────────────────────────────── */}
      <Panel index={0}>
        <PanelHeader
          eyebrow="Шаг 1"
          title="Файл выписки"
          description="Выгрузите операции из банка в CSV или PDF и выберите файл"
        />

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.pdf,text/csv,text/plain,application/pdf"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "mt-4 flex w-full cursor-pointer flex-col items-center justify-center gap-2",
            "rounded-[12px] border border-dashed border-line-strong px-4 py-8",
            "transition-colors duration-200 hover:border-accent hover:bg-accent-soft/40",
          )}
        >
          {isReading ? (
            <Loader2 size={22} className="animate-spin text-ink-faint" />
          ) : (
            <FileUp size={22} className="text-ink-faint" />
          )}
          <span className="text-sm font-medium text-ink">
            {isReading ? "Читаю файл…" : (fileName ?? "Выбрать файл выписки")}
          </span>
          <span className="text-[12px] text-ink-faint">
            CSV или PDF — Т-Банк, Сбер, Альфа, Газпромбанк
          </span>
        </button>

        {outcome ? (
          <p className="mt-4 flex items-start gap-2 rounded-[10px] bg-positive-soft px-3 py-3 text-[13px] text-positive">
            <Check size={15} className="mt-0.5 shrink-0" />
            <span>
              Добавлено {outcome.added}{" "}
              {pluralize(outcome.added, "трата", "траты", "трат")}.
              {outcome.duplicates > 0
                ? ` Пропущено ${outcome.duplicates} — они уже были импортированы раньше.`
                : ""}
            </span>
          </p>
        ) : null}

        {error ? (
          <p
            className="mt-4 flex items-start gap-2 rounded-[10px] bg-negative-soft px-3 py-3 text-[13px] text-negative"
            role="alert"
          >
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            {error}
          </p>
        ) : null}
      </Panel>

      {/* ─── Настройка колонок ──────────────────────────────────────────── */}
      {table && !pdfParsed ? (
        <Panel index={1}>
          <PanelHeader
            eyebrow="Шаг 2"
            title="Колонки"
            description="Проверьте, что приложение нашло нужные столбцы"
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(
              [
                { role: "date", label: "Дата", required: true },
                { role: "amount", label: "Сумма", required: true },
                { role: "description", label: "Описание", required: false },
                { role: "category", label: "Категория банка", required: false },
              ] as Array<{ role: ColumnRole; label: string; required: boolean }>
            ).map((field) => (
              <Field
                key={field.role}
                label={field.label}
                hint={field.required ? "обязательно" : "необязательно"}
              >
                {(id) => (
                  <Select
                    id={id}
                    value={String(columns[field.role])}
                    onChange={(event) =>
                      setColumns({ ...columns, [field.role]: Number(event.target.value) })
                    }
                  >
                    <option value="-1">— не использовать —</option>
                    {headers.map((header, index) => (
                      <option key={index} value={index}>
                        {header || `Колонка ${index + 1}`}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ))}
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-[10px] bg-surface-2 px-3 py-3">
            <input
              type="checkbox"
              checked={treatAllAsExpense}
              onChange={(event) => setTreatAllAsExpense(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
            />
            <span className="text-[12px] leading-relaxed text-ink-muted">
              Считать тратами все строки. Нужно, если банк выгружает списания без
              минуса — тогда поступления от трат не отличить по знаку.
            </span>
          </label>
        </Panel>
      ) : null}

      {/* ─── Предпросмотр ───────────────────────────────────────────────── */}
      {parsed ? (
        <Panel index={2} flush>
          <div className="p-4 sm:p-5">
            <PanelHeader
              eyebrow="Шаг 3"
              title="Что будет добавлено"
              description={
                expenseRows.length === 0
                  ? hiddenByDate > 0
                    ? "Все операции раньше выбранной даты"
                    : "Списаний не нашлось — проверьте колонку с суммой"
                  : `${selectedRows.length} из ${expenseRows.length} ${pluralize(
                      expenseRows.length,
                      "строки",
                      "строк",
                      "строк",
                    )}`
              }
              actions={
                selectedRows.length > 0 ? (
                  <Button variant="primary" onClick={handleImport} disabled={isPending}>
                    {isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Upload size={16} />
                    )}
                    Импортировать
                  </Button>
                ) : undefined
              }
            />

            {/* Нижняя граница периода */}
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <Field
                label="Переносить с даты"
                className="w-[170px]"
                hint={
                  earliestDate
                    ? `выписка с ${formatDayMonthShort(earliestDate)}`
                    : "пусто — все операции"
                }
              >
                {(id) => (
                  <TextInput
                    id={id}
                    type="date"
                    value={fromDate}
                    min={earliestDate ?? undefined}
                    onChange={(event) => setFromDate(event.target.value)}
                  />
                )}
              </Field>

              {fromDate ? (
                <Button size="sm" variant="ghost" onClick={() => setFromDate("")}>
                  <CalendarX size={15} />
                  Снять ограничение
                </Button>
              ) : null}
            </div>

            {hiddenByDate > 0 ? (
              <p className="mt-2 text-[12px] text-ink-faint">
                Скрыто операций раньше выбранной даты: {hiddenByDate}.
              </p>
            ) : null}

            {incomeCount > 0 || parsed.skipped > 0 ? (
              <p className="mt-3 text-[12px] text-ink-faint">
                {incomeCount > 0 ? `Не отмечено: ${incomeCount}. ` : ""}
                {parsed.skipped > 0 ? `Нераспознанных строк: ${parsed.skipped}.` : ""}
              </p>
            ) : null}

            {transfersFound > 0 ? (
              <p className="mt-2 text-[12px] text-ink-muted">
                Переводов между своими счетами: {transfersFound}. Они сняты с
                отметки — деньги никуда не потрачены, и в расходах они бы
                удвоили месяц.
              </p>
            ) : null}
          </div>

          {expenseRows.length > 0 ? (
            <ul className="border-t border-line">
              {expenseRows.map((row) => {
                const state = rowStates[row.line];
                const excluded = state?.excluded ?? false;

                return (
                  <li
                    key={row.line}
                    className={cn(
                      "flex flex-wrap items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0 sm:px-4",
                      excluded && "opacity-40",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={!excluded}
                      aria-label={`Импортировать: ${row.description || row.date}`}
                      onChange={(event) =>
                        setRowStates({
                          ...rowStates,
                          [row.line]: {
                            excluded: !event.target.checked,
                            categoryId: categoryFor(row.line, row.categoryId),
                          },
                        })
                      }
                      className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                    />

                    <span className="tabular w-[52px] shrink-0 text-[12px] text-ink-faint">
                      {formatDayMonthShort(row.date)}
                    </span>

                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                      {row.description || row.bankCategory || "Без описания"}
                    </span>

                    <span className="tabular shrink-0 text-[13px] font-medium text-ink">
                      {formatRub(row.amount, 0)}
                    </span>

                    <Select
                      aria-label="Категория"
                      value={categoryFor(row.line, row.categoryId)}
                      onChange={(event) =>
                        setRowStates({
                          ...rowStates,
                          [row.line]: {
                            excluded,
                            categoryId: event.target.value,
                          },
                        })
                      }
                      className="h-9 w-full text-[12px] sm:w-[150px]"
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}
