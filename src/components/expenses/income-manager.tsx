"use client";

import { Check, Loader2, Plus, Trash2, Wallet, X } from "lucide-react";
import { useState, useTransition } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { AmountInput, Field, TextInput } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/misc";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { createIncome, deleteIncome } from "@/lib/actions/income";
import type { Income, IsoDate } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { formatDayMonth } from "@/lib/utils/date";
import { formatRub, parseAmount, pluralize } from "@/lib/utils/format";

/**
 * Доходы за месяц: добавление и список.
 *
 * Форма в одну строку, как быстрый ввод трат: доход заносят редко, но когда
 * заносят — хочется сделать это в два касания, а не открывать модальное окно.
 */

interface IncomeManagerProps {
  incomes: Income[];
  total: number;
  today: IsoDate;
}

/** Частые источники — подставляются в поле одним нажатием. */
const SOURCE_HINTS = ["Стипендия", "Родители", "Подработка", "Возврат"];

export function IncomeManager({ incomes, total, today }: IncomeManagerProps) {
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = parseAmount(amount);
    if (parsed === null || parsed <= 0) {
      setError("Укажите сумму больше нуля.");
      return;
    }

    startTransition(async () => {
      const result = await createIncome({ date, amount: parsed, source });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setAmount("");
      setSource("");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Добавление ─────────────────────────────────────────────────── */}
      <Panel index={0}>
        <PanelHeader
          eyebrow="Доход"
          title="Новое поступление"
          description="Стипендия, перевод, подработка — всё, из чего складывается бюджет"
        />

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
            <Field label="Сумма" className="sm:w-[160px]" error={error ?? undefined}>
              {(id) => (
                <AmountInput
                  id={id}
                  value={amount}
                  placeholder="30 000"
                  onChange={(event) => setAmount(event.target.value)}
                />
              )}
            </Field>

            <Field label="Источник" className="flex-1">
              {(id) => (
                <TextInput
                  id={id}
                  value={source}
                  maxLength={80}
                  placeholder="Стипендия"
                  onChange={(event) => setSource(event.target.value)}
                />
              )}
            </Field>

            <Field label="Дата" className="sm:w-[150px]">
              {(id) => (
                <TextInput
                  id={id}
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              )}
            </Field>

            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              Добавить
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {SOURCE_HINTS.map((hint) => (
              <button
                key={hint}
                type="button"
                onClick={() => setSource(hint)}
                className={cn(
                  "h-8 cursor-pointer rounded-full border px-3 text-[12px]",
                  "transition-colors duration-200",
                  source === hint
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line text-ink-muted hover:text-ink",
                )}
              >
                {hint}
              </button>
            ))}
          </div>
        </form>
      </Panel>

      {/* ─── Список ─────────────────────────────────────────────────────── */}
      <Panel index={1} flush>
        <div className="p-4 sm:p-5">
          <PanelHeader
            eyebrow="За месяц"
            title={formatRub(total, 0)}
            description={`${incomes.length} ${pluralize(
              incomes.length,
              "поступление",
              "поступления",
              "поступлений",
            )}`}
          />
        </div>

        {incomes.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Поступлений пока нет"
            description="Занесите доход — и появится прогноз, сколько можно тратить в день."
            className="border-t border-line"
          />
        ) : (
          <ul className="border-t border-line">
            {incomes.map((income) => (
              <IncomeRow key={income.id} income={income} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/** Строка списка с подтверждением удаления на месте. */
function IncomeRow({ income }: { income: Income }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <li
      className={cn(
        "flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0 sm:px-4",
        isPending && "opacity-50",
      )}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-positive-soft text-positive"
        aria-hidden
      >
        <Wallet size={15} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{income.source || "Поступление"}</p>
        <p className="tabular text-[12px] text-ink-faint">{formatDayMonth(income.date)}</p>
      </div>

      <span className="tabular shrink-0 text-sm font-medium text-positive">
        +{formatRub(income.amount, 0)}
      </span>

      {confirming ? (
        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            label="Подтвердить удаление"
            variant="danger"
            compact
            disabled={isPending}
            onClick={() => startTransition(async () => void (await deleteIncome(income.id)))}
          >
            {isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          </IconButton>
          <IconButton label="Отменить" compact onClick={() => setConfirming(false)}>
            <X size={15} />
          </IconButton>
        </div>
      ) : (
        <IconButton
          label="Удалить поступление"
          variant="danger"
          compact
          onClick={() => setConfirming(true)}
        >
          <Trash2 size={15} />
        </IconButton>
      )}
    </li>
  );
}
