"use client";

import { CornerDownLeft, Loader2, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, Select, TextInput } from "@/components/ui/field";
import { getCategoryIcon } from "@/config/icons";
import { createExpense } from "@/lib/actions/expenses";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { formatRub } from "@/lib/utils/format";
import { parseQuickEntry } from "@/lib/utils/quick-parse";

/**
 * Быстрое добавление траты одной строкой.
 *
 * Пользователь печатает «Магазин — 1200» и жмёт Enter: сумма, заметка и
 * категория разбираются автоматически (см. lib/utils/quick-parse.ts).
 * Категорию можно переопределить — после ручного выбора автоподстановка
 * перестаёт вмешиваться до отправки формы.
 */

interface QuickAddExpenseProps {
  categories: Category[];
  /** Дата по умолчанию — сегодня. Приходит с сервера, чтобы не расходиться. */
  defaultDate: string;
}

export function QuickAddExpense({ categories, defaultDate }: QuickAddExpenseProps) {
  const [raw, setRaw] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseQuickEntry(raw, categories), [raw, categories]);

  // Пока пользователь не выбрал категорию сам, подставляем угаданную.
  useEffect(() => {
    if (!categoryTouched && parsed.categoryId) {
      setCategoryId(parsed.categoryId);
    }
  }, [parsed.categoryId, categoryTouched]);

  const selectedCategory = categories.find((category) => category.id === categoryId);
  const CategoryIcon = getCategoryIcon(selectedCategory?.icon ?? "tag");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (parsed.amount === null) {
      setError("Не нашёл сумму. Например: «Кофе 400».");
      return;
    }
    if (!categoryId) {
      setError("Выберите категорию.");
      return;
    }

    startTransition(async () => {
      const result = await createExpense({
        date,
        categoryId,
        note: parsed.note,
        amount: parsed.amount ?? 0,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Сбрасываем только текст: дата и категория обычно те же для серии трат.
      setRaw("");
      setCategoryTouched(false);
      inputRef.current?.focus();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-spotlight
      className="spotlight relative rounded-[14px] border border-line bg-surface/85 p-3 backdrop-blur-xl sm:p-4"
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
        <Field
          label="Что и на сколько"
          hideLabel
          className="flex-1"
          error={error ?? undefined}
        >
          {(id) => (
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
                <Plus size={16} />
              </span>
              <TextInput
                id={id}
                ref={inputRef}
                value={raw}
                onChange={(event) => setRaw(event.target.value)}
                placeholder="Магазин — 1200"
                autoComplete="off"
                enterKeyHint="done"
                className="pl-9 pr-12"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 text-ink-faint sm:block">
                <CornerDownLeft size={14} />
              </span>
            </div>
          )}
        </Field>

        <div className="flex gap-2">
          <Field label="Категория" hideLabel className="min-w-0 flex-1 sm:w-40 sm:flex-none">
            {(id) => (
              <Select
                id={id}
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setCategoryTouched(true);
                }}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Дата" hideLabel className="w-[140px] shrink-0">
            {(id) => (
              <TextInput
                id={id}
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            )}
          </Field>
        </div>

        <Button type="submit" variant="primary" disabled={isPending} className="sm:px-5">
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Добавить
        </Button>
      </div>

      {/* Живой разбор строки: видно, что именно уйдёт в базу. */}
      <div
        className={cn(
          "mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] transition-opacity duration-200",
          raw.trim() ? "opacity-100" : "opacity-0",
        )}
        aria-live="polite"
      >
        <span className="tabular font-medium text-ink">
          {parsed.amount === null ? "сумма не найдена" : formatRub(parsed.amount)}
        </span>
        {parsed.note ? <span className="text-ink-muted">{parsed.note}</span> : null}
        {selectedCategory ? (
          <span
            className="inline-flex items-center gap-1"
            style={{ color: selectedCategory.color }}
          >
            <CategoryIcon size={12} />
            {selectedCategory.name}
          </span>
        ) : null}
      </div>
    </form>
  );
}
