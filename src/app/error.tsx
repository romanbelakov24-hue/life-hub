"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

/**
 * Граница ошибок приложения.
 *
 * Самая вероятная причина здесь — недоступная база: не заданы переменные
 * Turso или пропала сеть. Поэтому вместо абстрактного «что-то пошло не так»
 * подсказываем, куда смотреть, и даём кнопку повтора без перезагрузки страницы.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <Panel className="mt-6">
      <div className="flex flex-col items-start gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-negative-soft text-negative">
          <AlertTriangle size={20} />
        </span>

        <div>
          <h1 className="font-display text-lg font-semibold text-ink">Не удалось загрузить данные</h1>
          <p className="mt-1.5 max-w-md text-[13px] leading-snug text-ink-muted">
            Чаще всего дело в подключении к базе. Проверьте, что в{" "}
            <code className="rounded bg-surface-2 px-1 py-0.5 text-[12px]">.env.local</code>{" "}
            заданы <code className="rounded bg-surface-2 px-1 py-0.5 text-[12px]">TURSO_DATABASE_URL</code>{" "}
            и <code className="rounded bg-surface-2 px-1 py-0.5 text-[12px]">TURSO_AUTH_TOKEN</code>,
            и что есть интернет.
          </p>

          {error.digest ? (
            <p className="tabular mt-2 text-[11px] text-ink-faint">Код ошибки: {error.digest}</p>
          ) : null}
        </div>

        <Button variant="primary" onClick={reset}>
          <RotateCw size={16} />
          Повторить
        </Button>
      </div>
    </Panel>
  );
}
