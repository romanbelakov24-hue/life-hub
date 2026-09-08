"use client";

import { Check, Loader2, Pencil, Plus, Settings2, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { AmountInput, Field, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { getCategoryIcon, ICON_KEYS } from "@/config/icons";
import { DEFAULT_COLOR, PALETTE } from "@/config/palette";
import { createCategory, deleteCategory, updateCategory } from "@/lib/actions/expenses";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

/**
 * Управление категориями трат: добавление своих, переименование, смена цвета
 * и иконки, удаление пустых.
 *
 * Базовые категории защищены от удаления (в них уже могут быть траты), но
 * переименовать и перекрасить можно любую — это правится в actions/expenses.ts.
 */

interface CategoryManagerProps {
  categories: Category[];
}

/** Черновик формы категории — общий для создания и редактирования. */
interface CategoryDraft {
  name: string;
  color: string;
  icon: string;
  /** Строкой, как в поле ввода — пусто значит «без лимита». */
  monthlyLimit: string;
}

const EMPTY_DRAFT: CategoryDraft = { name: "", color: DEFAULT_COLOR, icon: "tag", monthlyLimit: "" };

/** "1200" -> 1200; "" -> null — то, что реально уходит в действие. */
function parseLimitInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function CategoryManager({ categories }: CategoryManagerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setIsOpen(true)}>
        <Settings2 size={15} />
        Категории
      </Button>

      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Категории трат"
        description="Добавьте свои категории или измените существующие"
      >
        <CategoryList categories={categories} />
      </Modal>
    </>
  );
}

function CategoryList({ categories }: CategoryManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteCategory(id);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {categories.map((category) => {
          const Icon = getCategoryIcon(category.icon);

          if (editingId === category.id) {
            return (
              <li key={category.id}>
                <CategoryForm
                  initial={{
                    name: category.name,
                    color: category.color,
                    icon: category.icon,
                    monthlyLimit: category.monthlyLimit !== null ? String(category.monthlyLimit) : "",
                  }}
                  submitLabel="Сохранить"
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (draft) => {
                    const result = await updateCategory(category.id, {
                      ...draft,
                      monthlyLimit: parseLimitInput(draft.monthlyLimit),
                    });
                    if (result.ok) setEditingId(null);
                    return result.ok ? null : result.error;
                  }}
                />
              </li>
            );
          }

          return (
            <li
              key={category.id}
              className="flex items-center gap-3 rounded-[10px] border border-line px-3 py-2"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]"
                style={{ backgroundColor: `${category.color}1f`, color: category.color }}
                aria-hidden
              >
                <Icon size={15} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{category.name}</span>
                {category.monthlyLimit !== null ? (
                  <span className="block truncate text-[11px] text-ink-faint">
                    лимит {category.monthlyLimit.toLocaleString("ru-RU")} ₽/мес
                  </span>
                ) : null}
              </span>

              {category.isDefault ? (
                <span className="shrink-0 text-[11px] text-ink-faint">базовая</span>
              ) : null}

              <div className="flex shrink-0 items-center gap-0.5">
                <IconButton
                  label={`Изменить категорию ${category.name}`}
                  compact
                  onClick={() => {
                    setError(null);
                    setEditingId(category.id);
                  }}
                >
                  <Pencil size={15} />
                </IconButton>

                {category.isDefault ? null : (
                  <IconButton
                    label={`Удалить категорию ${category.name}`}
                    variant="danger"
                    compact
                    disabled={isPending}
                    onClick={() => handleDelete(category.id)}
                  >
                    <Trash2 size={15} />
                  </IconButton>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {error ? (
        <p className="rounded-[10px] bg-negative-soft px-3 py-2 text-[12px] text-negative" role="alert">
          {error}
        </p>
      ) : null}

      {isAdding ? (
        <CategoryForm
          initial={EMPTY_DRAFT}
          submitLabel="Добавить"
          onCancel={() => setIsAdding(false)}
          onSubmit={async (draft) => {
            const result = await createCategory({
              ...draft,
              monthlyLimit: parseLimitInput(draft.monthlyLimit),
            });
            if (result.ok) setIsAdding(false);
            return result.ok ? null : result.error;
          }}
        />
      ) : (
        <Button
          onClick={() => {
            setError(null);
            setIsAdding(true);
          }}
        >
          <Plus size={16} />
          Новая категория
        </Button>
      )}
    </div>
  );
}

interface CategoryFormProps {
  initial: CategoryDraft;
  submitLabel: string;
  onCancel: () => void;
  /** Возвращает текст ошибки или null при успехе. */
  onSubmit: (draft: CategoryDraft) => Promise<string | null>;
}

function CategoryForm({ initial, submitLabel, onCancel, onSubmit }: CategoryFormProps) {
  const [draft, setDraft] = useState<CategoryDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const message = await onSubmit(draft);
      setError(message);
    });
  }

  const PreviewIcon = getCategoryIcon(draft.icon);

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-[12px] border border-line bg-surface-2 p-3"
    >
      <div className="flex items-end gap-2">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px]"
          style={{ backgroundColor: `${draft.color}24`, color: draft.color }}
          aria-hidden
        >
          <PreviewIcon size={18} />
        </span>

        <Field label="Название" className="flex-1">
          {(id) => (
            <TextInput
              id={id}
              value={draft.name}
              autoFocus
              maxLength={40}
              placeholder="Например: Спорт"
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          )}
        </Field>
      </div>

      <Field label="Лимит в месяц" hint="Необязательно — покажется в блоке «Бюджеты по категориям»">
        {(id) => (
          <AmountInput
            id={id}
            value={draft.monthlyLimit}
            placeholder="Без лимита"
            onChange={(event) => setDraft({ ...draft, monthlyLimit: event.target.value })}
          />
        )}
      </Field>

      {/* Цвет */}
      <div>
        <p className="mb-1.5 text-[12px] font-medium text-ink-muted">Цвет</p>
        <div className="flex flex-wrap gap-1.5">
          {PALETTE.map((entry) => (
            <button
              key={entry.value}
              type="button"
              aria-label={entry.label}
              aria-pressed={draft.color === entry.value}
              title={entry.label}
              onClick={() => setDraft({ ...draft, color: entry.value })}
              className={cn(
                "h-7 w-7 cursor-pointer rounded-full border-2 transition-transform duration-200",
                draft.color === entry.value
                  ? "border-ink scale-110"
                  : "border-transparent hover:scale-105",
              )}
              style={{ backgroundColor: entry.value }}
            />
          ))}
        </div>
      </div>

      {/* Иконка */}
      <div>
        <p className="mb-1.5 text-[12px] font-medium text-ink-muted">Иконка</p>
        <div className="flex flex-wrap gap-1.5">
          {ICON_KEYS.map((key) => {
            const Icon = getCategoryIcon(key);
            const isActive = draft.icon === key;

            return (
              <button
                key={key}
                type="button"
                aria-label={`Иконка ${key}`}
                aria-pressed={isActive}
                onClick={() => setDraft({ ...draft, icon: key })}
                className={cn(
                  "flex h-9 w-9 cursor-pointer items-center justify-center rounded-[9px] border",
                  "transition-colors duration-200",
                  isActive
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line text-ink-muted hover:bg-surface-3",
                )}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <p className="text-[12px] text-negative" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X size={15} />
          Отмена
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={isPending}>
          {isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
