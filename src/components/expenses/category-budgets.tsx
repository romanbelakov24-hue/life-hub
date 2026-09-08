import { PiggyBank } from "lucide-react";

import { ShareBar } from "@/components/ui/misc";
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
 */

interface CategoryBudgetsProps {
  budgets: CategoryBudgetStatus[];
  index?: number;
}

export function CategoryBudgets({ budgets, index }: CategoryBudgetsProps) {
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
        <ul className="mt-4 flex flex-col gap-4">
          {budgets.map((budget) => {
            const Icon = getCategoryIcon(budget.icon);
            const isOver = budget.remaining < 0;
            const barColor = isOver
              ? "var(--negative)"
              : budget.percent >= 80
                ? "#e0a62f"
                : budget.color;

            return (
              <li key={budget.categoryId}>
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]"
                    style={{ backgroundColor: `${budget.color}1f`, color: budget.color }}
                    aria-hidden
                  >
                    <Icon size={14} />
                  </span>

                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                    {budget.name}
                  </span>

                  <span className="tabular shrink-0 text-[12px] text-ink-muted">
                    {formatRub(budget.spent, 0)} из {formatRub(budget.limit, 0)}
                  </span>
                </div>

                <ShareBar value={budget.percent} color={barColor} className="mt-2" />

                <p className={`mt-1 text-[11px] ${isOver ? "text-negative" : "text-ink-faint"}`}>
                  {isOver
                    ? `Перерасход на ${formatRub(Math.abs(budget.remaining), 0)}`
                    : `Осталось ${formatRub(budget.remaining, 0)}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
