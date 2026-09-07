import type { ReactNode } from "react";

import { Wordmark } from "@/components/layout/sidebar";
import { Panel } from "@/components/ui/panel";

/** Общий каркас страниц входа и регистрации: логотип по центру и панель формы. */
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="relative z-10 flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <Wordmark />
          <h1 className="animate-rise mt-4 font-display text-[22px] font-bold tracking-[-0.02em] text-ink">
            {title}
          </h1>
          <p className="animate-rise stagger mt-1.5 text-[13px] text-ink-muted" style={{ "--i": 1 } as React.CSSProperties}>
            {description}
          </p>
        </div>

        <Panel index={2}>{children}</Panel>
      </div>
    </main>
  );
}
