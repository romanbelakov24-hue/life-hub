import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/app-shell";
import { IncomeManager } from "@/components/expenses/income-manager";
import { listIncomesInRange, sumIncomesInRange } from "@/lib/queries/income";
import { endOfMonth, formatMonthTitle, startOfMonth, todayIso } from "@/lib/utils/date";

/** Доходы за текущий месяц: из них считается дневной лимит на странице расходов. */

export const metadata: Metadata = { title: "Доходы" };

export const dynamic = "force-dynamic";

export default async function IncomePage() {
  const today = todayIso();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const [incomes, total] = await Promise.all([
    listIncomesInRange(monthStart, monthEnd),
    sumIncomesInRange(monthStart, monthEnd),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Финансы"
        title="Доходы"
        description={formatMonthTitle(today)}
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

      <IncomeManager incomes={incomes} total={total} today={today} />
    </>
  );
}
