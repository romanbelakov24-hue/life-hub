import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/app-shell";
import { GoalsManager } from "@/components/expenses/goals-manager";
import { buildSavingsGoalStatuses } from "@/lib/analytics/savings";
import { requireUser } from "@/lib/auth/user";
import { listContributions, listSavingsGoals } from "@/lib/queries/savings";
import type { SavingsContribution } from "@/lib/types";
import { todayIso } from "@/lib/utils/date";

/** Цели накопления: сумма, необязательный срок и лента пополнений. */

export const metadata: Metadata = { title: "Цели накоплений" };

export const dynamic = "force-dynamic";

function groupByGoal(contributions: SavingsContribution[]): Map<string, SavingsContribution[]> {
  const map = new Map<string, SavingsContribution[]>();
  for (const contribution of contributions) {
    const bucket = map.get(contribution.goalId);
    if (bucket) {
      bucket.push(contribution);
    } else {
      map.set(contribution.goalId, [contribution]);
    }
  }
  return map;
}

export default async function GoalsPage() {
  const user = await requireUser();
  const today = todayIso();

  const [goals, contributions] = await Promise.all([
    listSavingsGoals(user.id),
    listContributions(user.id),
  ]);

  const statuses = buildSavingsGoalStatuses(goals, contributions, today);
  const contributionsByGoal = groupByGoal(contributions);

  return (
    <>
      <PageHeader
        eyebrow="Финансы"
        title="Цели накоплений"
        description="Отдельно от дневного бюджета — свой прогресс на свою покупку"
        actions={
          <Link
            href="/expenses"
            className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] font-medium text-ink-muted transition-colors duration-200 hover:text-ink"
          >
            <ArrowLeft size={15} />
            К расходам
          </Link>
        }
      />

      <GoalsManager goals={statuses} contributionsByGoal={contributionsByGoal} today={today} />
    </>
  );
}
