"use client";

import {
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  PiggyBank,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useState, useTransition } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { AmountInput, Field, TextInput } from "@/components/ui/field";
import { EmptyState, ShareBar } from "@/components/ui/misc";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { getCategoryIcon, ICON_KEYS } from "@/config/icons";
import { DEFAULT_COLOR, PALETTE } from "@/config/palette";
import {
  addContribution,
  createGoal,
  deleteContribution,
  deleteGoal,
  updateGoal,
} from "@/lib/actions/savings";
import type { IsoDate, SavingsContribution, SavingsGoalStatus } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { formatDayMonth } from "@/lib/utils/date";
import { formatRub, parseAmount, pluralize } from "@/lib/utils/format";

/**
 * Управление целями накоплений: создание, редактирование, пополнения.
 *
 * Форма цели — по образцу CategoryManager (название, цвет, иконка, тут ещё
 * сумма и срок), пополнения — по образцу IncomeManager (однострочная форма +
 * список с удалением). Оба уже обкатанных паттерна, просто на одном экране,
 * потому что у цели ровно два действия: завести/поправить саму цель и
 * закинуть в неё денег.
 */

interface GoalsManagerProps {
  goals: SavingsGoalStatus[];
  contributionsByGoal: Map<string, SavingsContribution[]>;
  today: IsoDate;
}

interface GoalDraft {
  name: string;
  color: string;
  icon: string;
  targetAmount: string;
  targetDate: string;
}

const EMPTY_DRAFT: GoalDraft = {
  name: "",
  color: DEFAULT_COLOR,
  icon: "tag",
  targetAmount: "",
  targetDate: "",
};

export function GoalsManager({ goals, contributionsByGoal, today }: GoalsManagerProps) {
  const [isAdding, setIsAdding] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Panel index={0}>
        <PanelHeader
          eyebrow="Новая цель"
          title="Название, сумма и срок"
          description="Срок необязателен — без него просто увидите долю выполнения"
        />

        <div className="mt-4">
          {isAdding ? (
            <GoalForm
              initial={EMPTY_DRAFT}
              submitLabel="Создать"
              onCancel={() => setIsAdding(false)}
              onSubmit={async (draft) => {
                const result = await createGoal(toGoalInput(draft));
                if (result.ok) setIsAdding(false);
                return result.ok ? null : result.error;
              }}
            />
          ) : (
            <Button onClick={() => setIsAdding(true)}>
              <Plus size={16} />
              Новая цель
            </Button>
          )}
        </div>
      </Panel>

      {goals.length === 0 ? (
        <Panel index={1} flush>
          <EmptyState
            icon={PiggyBank}
            title="Целей пока нет"
            description="Заведите первую выше — и начните откладывать."
          />
        </Panel>
      ) : (
        goals.map((goal, position) => (
          <GoalCard
            key={goal.goalId}
            goal={goal}
            contributions={contributionsByGoal.get(goal.goalId) ?? []}
            today={today}
            index={position + 1}
          />
        ))
      )}
    </div>
  );
}

function toGoalInput(draft: GoalDraft) {
  return {
    name: draft.name,
    color: draft.color,
    icon: draft.icon,
    targetAmount: parseAmount(draft.targetAmount) ?? 0,
    targetDate: draft.targetDate as IsoDate | "",
  };
}

// ─── Карточка цели ───────────────────────────────────────────────────────────

function GoalCard({
  goal,
  contributions,
  today,
  index,
}: {
  goal: SavingsGoalStatus;
  contributions: SavingsContribution[];
  today: IsoDate;
  index: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const Icon = getCategoryIcon(goal.icon);
  const barColor = goal.achieved ? "var(--positive)" : goal.color;
  const isOverdue = !goal.achieved && goal.daysLeft !== null && goal.daysLeft < 0;

  const visibleContributions = showHistory ? contributions : contributions.slice(0, 3);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteGoal(goal.goalId);
      if (!result.ok) setError(result.error);
    });
  }

  if (isEditing) {
    return (
      <Panel index={index}>
        <GoalForm
          initial={{
            name: goal.name,
            color: goal.color,
            icon: goal.icon,
            targetAmount: String(goal.targetAmount),
            targetDate: goal.targetDate ?? "",
          }}
          submitLabel="Сохранить"
          onCancel={() => setIsEditing(false)}
          onSubmit={async (draft) => {
            const result = await updateGoal(goal.goalId, toGoalInput(draft));
            if (result.ok) setIsEditing(false);
            return result.ok ? null : result.error;
          }}
        />
      </Panel>
    );
  }

  return (
    <Panel index={index} className={isPending ? "opacity-60" : undefined}>
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
          style={{ backgroundColor: `${goal.color}1f`, color: goal.color }}
          aria-hidden
        >
          {goal.achieved ? <Check size={18} /> : <Icon size={18} />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-ink">{goal.name}</p>
              <p className="tabular mt-0.5 text-[12px] text-ink-muted">
                {formatRub(goal.saved, 0)} из {formatRub(goal.targetAmount, 0)}
                {goal.targetDate ? ` · до ${formatDayMonth(goal.targetDate)}` : ""}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              <IconButton label={`Изменить цель ${goal.name}`} compact onClick={() => setIsEditing(true)}>
                <Pencil size={15} />
              </IconButton>

              {confirmingDelete ? (
                <>
                  <IconButton
                    label="Подтвердить удаление"
                    variant="danger"
                    compact
                    disabled={isPending}
                    onClick={handleDelete}
                  >
                    {isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  </IconButton>
                  <IconButton label="Отменить" compact onClick={() => setConfirmingDelete(false)}>
                    <X size={15} />
                  </IconButton>
                </>
              ) : (
                <IconButton
                  label={`Удалить цель ${goal.name}`}
                  variant="danger"
                  compact
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2 size={15} />
                </IconButton>
              )}
            </div>
          </div>

          <ShareBar value={goal.percent} color={barColor} className="mt-3" />

          <p className={cn("mt-1.5 text-[12px]", isOverdue ? "text-negative" : "text-ink-faint")}>
            {goal.achieved
              ? "Цель достигнута 🎉"
              : isOverdue
                ? `Срок прошёл ${formatDayMonth(goal.targetDate ?? "")} — осталось ${formatRub(goal.remaining, 0)}`
                : goal.suggestedMonthly !== null
                  ? `Останется ${formatRub(goal.remaining, 0)} — примерно ${formatRub(goal.suggestedMonthly, 0)}/мес, чтобы успеть`
                  : `Осталось ${formatRub(goal.remaining, 0)}`}
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-[10px] bg-negative-soft px-3 py-2 text-[12px] text-negative" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 border-t border-line pt-4">
        <ContributionForm goalId={goal.goalId} today={today} />

        {contributions.length > 0 ? (
          <div className="mt-3">
            <ul className="flex flex-col gap-1.5">
              {visibleContributions.map((contribution) => (
                <ContributionRow key={contribution.id} contribution={contribution} />
              ))}
            </ul>

            {contributions.length > 3 ? (
              <button
                type="button"
                onClick={() => setShowHistory((value) => !value)}
                className="mt-2 flex cursor-pointer items-center gap-1 text-[12px] font-medium text-ink-muted hover:text-ink"
              >
                <ChevronDown
                  size={13}
                  className={cn("transition-transform duration-200", showHistory && "rotate-180")}
                />
                {showHistory
                  ? "Свернуть"
                  : `Ещё ${contributions.length - 3} ${pluralize(
                      contributions.length - 3,
                      "пополнение",
                      "пополнения",
                      "пополнений",
                    )}`}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

// ─── Форма пополнения ────────────────────────────────────────────────────────

function ContributionForm({ goalId, today }: { goalId: string; today: IsoDate }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
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
      const result = await addContribution({ goalId, date, amount: parsed, note });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAmount("");
      setNote("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label="Отложить" className="sm:w-[140px]">
          {(id) => (
            <AmountInput
              id={id}
              value={amount}
              placeholder="1 000"
              onChange={(event) => setAmount(event.target.value)}
            />
          )}
        </Field>

        <Field label="Заметка" hideLabel className="flex-1">
          {(id) => (
            <TextInput
              id={id}
              value={note}
              maxLength={120}
              placeholder="Заметка — необязательно"
              onChange={(event) => setNote(event.target.value)}
            />
          )}
        </Field>

        <Field label="Дата" hideLabel className="sm:w-[140px]">
          {(id) => (
            <TextInput
              id={id}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          )}
        </Field>

        <Button type="submit" size="sm" variant="secondary" disabled={isPending}>
          {isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Добавить
        </Button>
      </div>

      {error ? (
        <p className="text-[12px] text-negative" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function ContributionRow({ contribution }: { contribution: SavingsContribution }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <li
      className={cn(
        "flex items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-[12px]",
        isPending && "opacity-50",
      )}
    >
      <span className="tabular shrink-0 text-ink-faint">{formatDayMonth(contribution.date)}</span>
      <span className="min-w-0 flex-1 truncate text-ink-muted">{contribution.note}</span>
      <span className="tabular shrink-0 font-medium text-positive">
        +{formatRub(contribution.amount, 0)}
      </span>

      {confirming ? (
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton
            label="Подтвердить удаление"
            variant="danger"
            compact
            disabled={isPending}
            onClick={() =>
              startTransition(async () => void (await deleteContribution(contribution.id)))
            }
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          </IconButton>
          <IconButton label="Отменить" compact onClick={() => setConfirming(false)}>
            <X size={13} />
          </IconButton>
        </div>
      ) : (
        <IconButton
          label="Удалить пополнение"
          variant="danger"
          compact
          onClick={() => setConfirming(true)}
        >
          <Trash2 size={13} />
        </IconButton>
      )}
    </li>
  );
}

// ─── Форма цели (создание/редактирование) ────────────────────────────────────

function GoalForm({
  initial,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  initial: GoalDraft;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (draft: GoalDraft) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState<GoalDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const PreviewIcon = getCategoryIcon(draft.icon);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const message = await onSubmit(draft);
      setError(message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
              maxLength={80}
              placeholder="Например: Новый ноутбук"
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          )}
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Сумма цели">
          {(id) => (
            <AmountInput
              id={id}
              value={draft.targetAmount}
              placeholder="60 000"
              onChange={(event) => setDraft({ ...draft, targetAmount: event.target.value })}
            />
          )}
        </Field>

        <Field label="Срок" hint="Необязательно">
          {(id) => (
            <TextInput
              id={id}
              type="date"
              value={draft.targetDate}
              onChange={(event) => setDraft({ ...draft, targetDate: event.target.value })}
            />
          )}
        </Field>
      </div>

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
