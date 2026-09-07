import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/app-shell";
import { StatementImport } from "@/components/expenses/statement-import";
import { requireUser } from "@/lib/auth/user";
import { listCategories } from "@/lib/queries/expenses";

/**
 * Импорт трат из банковской выписки.
 *
 * Отдельная страница, а не модальное окно: предпросмотр — это таблица на
 * десятки строк с выбором категории у каждой, и в окне её пришлось бы
 * прокручивать в прокручиваемой странице.
 */

export const metadata: Metadata = { title: "Импорт выписки" };

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const user = await requireUser();
  const categories = await listCategories(user.id);

  return (
    <>
      <PageHeader
        eyebrow="Финансы"
        title="Импорт"
        description="Загрузка операций из выписки банка"
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

      <StatementImport categories={categories} />
    </>
  );
}
