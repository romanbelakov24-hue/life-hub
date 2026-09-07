"use client";

import { Check, Copy, ExternalLink, Loader2, RefreshCw, Share2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { regenerateShareToken, toggleShareSummary } from "@/lib/actions/settings";
import { cn } from "@/lib/utils/cn";

/**
 * Управление публичной сводкой трат.
 *
 * Доступ и адрес разделены намеренно: выключение не меняет ссылку, поэтому
 * сводку можно закрыть на время и снова открыть, не рассылая новый адрес.
 * Смена адреса — отдельное действие для случая, когда ссылка утекла.
 */

interface ShareControlProps {
  shareUrl: string;
  enabled: boolean;
  index?: number;
}

export function ShareControl({ shareUrl, enabled: initialEnabled, index }: ShareControlProps) {
  const [url, setUrl] = useState(shareUrl);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [copied, setCopied] = useState(false);
  const [confirmingRotate, setConfirmingRotate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !enabled;
    setError(null);
    // Оптимистично: переключатель должен отзываться мгновенно, а не ждать
    // круга до базы в другом регионе.
    setEnabled(next);

    startTransition(async () => {
      const result = await toggleShareSummary(next);
      if (!result.ok) {
        setEnabled(!next);
        setError(result.error);
      }
    });
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Не удалось скопировать. Выделите адрес и скопируйте вручную.");
    }
  }

  function handleRotate() {
    setError(null);
    startTransition(async () => {
      const result = await regenerateShareToken();

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setUrl((current) => current.replace(/[^/]+$/, result.data.token));
      setConfirmingRotate(false);
    });
  }

  return (
    <Panel index={index}>
      <PanelHeader
        eyebrow="Доступ"
        title="Сводка для близких"
        description="Отдельная страница с итогами месяца — без списка покупок и без доступа к остальным разделам"
        actions={
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Открыть публичный доступ к сводке"
            onClick={handleToggle}
            disabled={isPending}
            className={cn(
              "relative h-7 w-12 shrink-0 cursor-pointer rounded-full border transition-colors duration-300",
              enabled
                ? "border-transparent bg-accent shadow-[0_0_20px_-4px_var(--glow-strong)]"
                : "border-line bg-surface-2",
            )}
          >
            <span
              className={cn(
                "absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all duration-300",
                enabled ? "left-[26px] bg-accent-ink" : "left-[3px] bg-ink-faint",
              )}
            />
          </button>
        }
      />

      {enabled ? (
        <>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <code
              className="min-w-0 flex-1 overflow-x-auto rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 font-mono text-[12px] text-ink-muted"
              style={{ whiteSpace: "nowrap" }}
            >
              {url}
            </code>

            <div className="flex gap-2">
              <Button
                onClick={handleCopy}
                variant={copied ? "outline" : "primary"}
                className="flex-1 shrink-0 sm:flex-none"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Скопировано" : "Копировать"}
              </Button>

              <Link
                href={url}
                target="_blank"
                rel="noreferrer"
                aria-label="Открыть сводку в новой вкладке"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-line text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
              >
                <ExternalLink size={16} />
              </Link>
            </div>
          </div>

          <p className="mt-3 rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12px] leading-relaxed text-ink-muted">
            На странице видны только сумма за месяц, сравнение с прошлым, ритм по
            дням и разбивка по категориям. Отдельные покупки, заметки и задачи
            туда не попадают.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            {confirmingRotate ? (
              <>
                <span className="text-[12px] text-ink-muted">
                  Разосланные ссылки перестанут открываться. Продолжить?
                </span>
                <Button size="sm" variant="danger" onClick={handleRotate} disabled={isPending}>
                  {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                  Сменить адрес
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmingRotate(false)}>
                  Отмена
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmingRotate(true)}>
                <RefreshCw size={14} />
                Сменить адрес
              </Button>
            )}
          </div>
        </>
      ) : (
        <p className="mt-4 flex items-start gap-2.5 rounded-[10px] bg-surface-2 px-3 py-3 text-[12px] leading-relaxed text-ink-muted">
          <Share2 size={14} className="mt-0.5 shrink-0" />
          Доступ закрыт — страница отдаёт «не найдено». Включите переключатель,
          чтобы получить ссылку.
        </p>
      )}

      {error ? (
        <p className="mt-3 text-[12px] text-negative" role="alert">
          {error}
        </p>
      ) : null}
    </Panel>
  );
}
