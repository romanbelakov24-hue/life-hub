import { Compass } from "lucide-react";
import Link from "next/link";

import { Panel } from "@/components/ui/panel";

/** Страница 404 — с быстрым возвратом на обзор. */
export default function NotFound() {
  return (
    <Panel className="mt-6">
      <div className="flex flex-col items-start gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-ink-faint">
          <Compass size={20} />
        </span>

        <div>
          <h1 className="font-display text-lg font-semibold text-ink">Страница не найдена</h1>
          <p className="mt-1.5 text-[13px] text-ink-muted">
            Такого раздела нет. Возможно, ссылка устарела.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex h-11 cursor-pointer items-center rounded-[10px] bg-accent px-4 text-sm font-medium text-accent-ink transition-[filter] duration-200 hover:brightness-110"
        >
          На обзор
        </Link>
      </div>
    </Panel>
  );
}
