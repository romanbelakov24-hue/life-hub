"use client";

import { AlertTriangle, PiggyBank } from "lucide-react";
import { useState } from "react";

import { Panel, PanelHeader } from "@/components/ui/panel";
import { getCategoryIcon } from "@/config/icons";
import type { CategoryBudgetStatus } from "@/lib/types";
import { formatRub } from "@/lib/utils/format";

/**
 * Лимиты по категориям: сколько уже потрачено из месячного лимита.
 *
 * В отличие от BudgetCard (дневной бюджет от дохода в целом), здесь — верхняя
 * граница на конкретную категорию, независимо от того, сколько денег пришло.
 * Лимит задаётся в редакторе категорий (кнопка «Категории» на этой же странице) —
 * пустое состояние показывает это прямо, а не прячет панель молча.
 *
 * Показаны стопкой карточек, как пропуска в Apple Wallet (.wallet-stack в
 * globals.css): у закрытых видна только шапка — название и «сколько из
 * скольки», тап раскрывает подробности. Открыта по умолчанию первая —
 * buildCategoryBudgets сортирует по проценту, так что это категория, ближе
 * всех подошедшая к лимиту или уже его перешедшая.
 */

interface CategoryBudgetsProps {
  budgets: CategoryBudgetStatus[];
  index?: number;
}

export function CategoryBudgets({ budgets, index }: CategoryBudgetsProps) {
  const [openId, setOpenId] = useState<string | null>(budgets[0]?.categoryId ?? null);

  return (
    <Panel index={index}>
      <PanelHeader
        eyebrow="Лимиты"
        title="Бюджеты по категориям"
        description="Задаются в редакторе категорий — кнопка «Категории» выше"
      />

      {budgets.length === 0 ? (
        <p className="mt-4 flex items-start gap-2.5 rounded-[10px] bg-surface-2 px-3 py-3 text-[13px] leading-relaxed text-ink-muted">
          <PiggyBank size={15} className="mt-0.5 shrink-0 text-ink-faint" />
          Пока ни у одной категории не задан лимит — откройте «Категории» и
          укажите его у нужной.
        </p>
      ) : (
        <ul className="wallet-stack mt-4">
          {budgets.map((budget) => (
            <WalletCard
              key={budget.categoryId}
              budget={budget}
              isOpen={openId === budget.categoryId}
              onToggle={() =>
                setOpenId((current) => (current === budget.categoryId ? null : budget.categoryId))
              }
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function WalletCard({
  budget,
  isOpen,
  onToggle,
}: {
  budget: CategoryBudgetStatus;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const Icon = getCategoryIcon(budget.icon);
  const isOver = budget.remaining < 0;
  const isNearLimit = !isOver && budget.percent >= 80;
  const bodyId = `budget-${budget.categoryId}`;

  return (
    <li
      className="wallet-card"
      data-open={isOpen}
      style={{ "--card": budget.color } as React.CSSProperties}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={bodyId}
        className="flex w-full cursor-pointer items-center gap-3 rounded-[16px] px-4 py-3.5 text-left"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-white/15"
          aria-hidden
        >
          <Icon size={15} />
        </span>

        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{budget.name}</span>

        <span className="tabular flex shrink-0 items-center gap-1.5 text-[12px] text-white/80">
          {isOver ? <AlertTriangle size={12} className="text-white" aria-label="Перерасход" /> : null}
          {formatRub(budget.spent, 0)} из {formatRub(budget.limit, 0)}
        </span>
      </button>

      <div className="collapsible" data-open={isOpen} id={bodyId} aria-hidden={!isOpen}>
        <div>
          <div className="px-4 pb-6 pt-1">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/70">
                  {isOver ? "Сверх лимита" : "Осталось"}
                </p>
                <p className="tabular mt-1 text-[26px] font-bold leading-none">
                  {formatRub(Math.abs(budget.remaining), 0)}
                </p>
              </div>

              {isOver || isNearLimit ? (
                <span className="shrink-0 rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]">
                  {isOver ? "Перерасход" : "Почти лимит"}
                </span>
              ) : null}
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20" role="presentation">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-500"
                style={{ width: `${Math.min(100, Math.max(0, budget.percent))}%` }}
              />
            </div>

            <p className="tabular mt-1.5 text-[11px] text-white/70">{budget.percent}% лимита</p>
          </div>
        </div>
      </div>
    </li>
  );
}
