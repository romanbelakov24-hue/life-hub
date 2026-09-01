"use client";

import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";

import { IconButton } from "@/components/ui/button";
import { AmountInput, Select, TextInput } from "@/components/ui/field";
import { getCategoryIcon } from "@/config/icons";
import { deleteExpense, updateExpense } from "@/lib/actions/expenses";
import type { Category, ExpenseWithCategory } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { formatRub, parseAmount } from "@/lib/utils/format";

/**
 * Строка таблицы трат с редактированием на месте.
 *
 * Режимы строки:
 *   view    — обычный просмотр;
 *   edit    — поля ввода прямо в строке, без модального окна;
 *   confirm — подтверждение удаления вместо кнопок действий.
 * Такой инлайн-режим быстрее модалки: правка суммы занимает два касания.
 */

type RowMode = "view" | "edit" | "confirm";

interface ExpenseRowProps {
  expense: ExpenseWithCategory;
  categories: Category[];
}

export function ExpenseRow({ expense, categories }: ExpenseRowProps) {
  const [mode, setMode] = useState<RowMode>("view");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Черновик правки. Инициализируется при каждом входе в режим редактирования.
  const [draft, setDraft] = useState({
    date: expense.date,
    categoryId: expense.categoryId,
    note: expense.note,
    amount: String(expense.amount),
  });

  const Icon = getCategoryIcon(expense.categoryIcon);

  function startEditing() {
    setDraft({
      date: expense.date,
      categoryId: expense.categoryId,
      note: expense.note,
      amount: String(expense.amount),
    });
    setError(null);
    setMode("edit");
  }

  function handleSave() {
    const amount = parseAmount(draft.amount);
    if (amount === null || amount <= 0) {
      setError("Сумма должна быть больше нуля.");
      return;
    }

    startTransition(async () => {
      const result = await updateExpense(expense.id, {
        date: draft.date,
        categoryId: draft.categoryId,
        note: draft.note,
        amount,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMode("view");
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteExpense(expense.id);
      if (!result.ok) {
        setError(result.error);
        setMode("view");
      }
    });
  }

  // ─── Режим редактирования ──────────────────────────────────────────────────
  if (mode === "edit") {
    return (
      <li className="border-b border-line bg-surface-2/60 px-3 py-3 last:border-b-0 sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <TextInput
            type="date"
            aria-label="Дата"
            value={draft.date}
            onChange={(event) => setDraft({ ...draft, date: event.target.value })}
            className="h-10 sm:w-[150px]"
          />

          <Select
            aria-label="Категория"
            value={draft.categoryId}
            onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}
            className="h-10 sm:w-[150px]"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>

          <TextInput
            aria-label="Заметка"
            value={draft.note}
            placeholder="Заметка"
            onChange={(event) => setDraft({ ...draft, note: event.target.value })}
            className="h-10 flex-1"
          />

          <AmountInput
            aria-label="Сумма"
            value={draft.amount}
            onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
            className="h-10 sm:w-[110px]"
          />

          <div className="flex items-center gap-1 self-end sm:self-auto">
            <IconButton
              label="Сохранить"
              variant="primary"
              compact
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            </IconButton>
            <IconButton label="Отменить" compact onClick={() => setMode("view")}>
              <X size={16} />
            </IconButton>
          </div>
        </div>

        {error ? (
          <p className="mt-2 text-[12px] text-negative" role="alert">
            {error}
          </p>
        ) : null}
      </li>
    );
  }

  // ─── Просмотр и подтверждение удаления ─────────────────────────────────────
  return (
    <li
      className={cn(
        "group flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0 sm:px-4",
        "transition-colors duration-200 hover:bg-surface-2/60",
        isPending && "opacity-50",
      )}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]"
        style={{ backgroundColor: `${expense.categoryColor}1f`, color: expense.categoryColor }}
        aria-hidden
      >
        <Icon size={15} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{expense.note || expense.categoryName}</p>
        <p className="truncate text-[12px] text-ink-faint">{expense.categoryName}</p>
      </div>

      <span className="tabular shrink-0 text-sm font-medium text-ink">
        {formatRub(expense.amount)}
      </span>

      {mode === "confirm" ? (
        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            label="Подтвердить удаление"
            variant="danger"
            compact
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          </IconButton>
          <IconButton label="Отменить удаление" compact onClick={() => setMode("view")}>
            <X size={16} />
          </IconButton>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton label="Изменить" compact onClick={startEditing}>
            <Pencil size={15} />
          </IconButton>
          <IconButton label="Удалить" variant="danger" compact onClick={() => setMode("confirm")}>
            <Trash2 size={15} />
          </IconButton>
        </div>
      )}
    </li>
  );
}
