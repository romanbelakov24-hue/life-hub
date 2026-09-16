"use client";

import { Bot, Check, Copy, KeyRound, Loader2, RefreshCw, ShieldOff } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { issueAgentAccess, revokeAgentAccess } from "@/lib/actions/settings";

/**
 * Доступ агента KAIROS к данным life hub.
 *
 * Токен показывается один раз — сразу после выпуска, и больше его не
 * увидеть: в базе хранится только хеш. Поэтому здесь три состояния, а не
 * «адрес + копировать», как у ленты календаря: доступа нет; токен только что
 * выпущен и виден; доступ есть, но токен уже скрыт.
 */

interface AgentAccessProps {
  /** Базовый адрес API, который прописывается в KAIROS как LIFEHUB_BASE. */
  apiBase: string;
  enabled: boolean;
  index?: number;
}

type Confirming = "rotate" | "revoke" | null;

export function AgentAccess({ apiBase, enabled: initialEnabled, index }: AgentAccessProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const envBlock = freshToken ? `LIFEHUB_BASE=${apiBase}\nLIFEHUB_TOKEN=${freshToken}` : "";

  function handleIssue() {
    setError(null);
    startTransition(async () => {
      const result = await issueAgentAccess();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setFreshToken(result.data.token);
      setEnabled(true);
      setCopied(false);
      setConfirming(null);
    });
  }

  function handleRevoke() {
    setError(null);
    startTransition(async () => {
      const result = await revokeAgentAccess();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setFreshToken(null);
      setEnabled(false);
      setConfirming(null);
    });
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(envBlock);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Не удалось скопировать. Выделите текст и скопируйте вручную.");
    }
  }

  return (
    <Panel index={index}>
      <PanelHeader
        eyebrow="Интеграции"
        title="Агент KAIROS"
        description="Задачи, траты, дела и заметки из Telegram — прямо сюда"
      />

      {freshToken ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="flex items-start gap-2.5 rounded-[10px] bg-warning-soft px-3 py-2.5 text-[12px] leading-relaxed text-warning">
            <KeyRound size={14} className="mt-0.5 shrink-0" />
            Скопируйте сейчас: после обновления страницы токен больше не показать —
            в базе хранится только его отпечаток. Потеряете — выпустите новый.
          </p>

          <pre className="overflow-x-auto rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 font-mono text-[12px] leading-relaxed text-ink">
            {envBlock}
          </pre>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleCopy} variant={copied ? "outline" : "primary"}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Скопировано" : "Копировать для .env"}
            </Button>
            <span className="text-[12px] text-ink-faint">
              Вставить в <code className="font-mono">kairos/.env</code> и перезапустить агента
            </span>
          </div>
        </div>
      ) : enabled ? (
        <p className="mt-4 flex items-start gap-2.5 rounded-[10px] bg-positive-soft px-3 py-3 text-[12px] leading-relaxed text-positive">
          <Bot size={14} className="mt-0.5 shrink-0" />
          Доступ выдан. Агент работает по адресу <code className="font-mono">{apiBase}</code>.
        </p>
      ) : (
        <div className="mt-4 flex flex-col items-start gap-3">
          <p className="text-[13px] leading-relaxed text-ink-muted">
            Агент сможет читать и создавать задачи, траты, дела в календаре и
            заметки, а также закрывать и переносить задачи. Удалять что-либо и
            видеть раздел «Здоровье» он не может.
          </p>
          <Button variant="primary" onClick={handleIssue} disabled={isPending}>
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            Выпустить токен
          </Button>
        </div>
      )}

      {enabled ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {confirming ? (
            <>
              <span className="text-[12px] text-ink-muted">
                {confirming === "rotate"
                  ? "Текущий токен перестанет работать — агента придётся перенастроить. Продолжить?"
                  : "Агент потеряет доступ, пока вы не выпустите новый токен. Продолжить?"}
              </span>
              <Button
                size="sm"
                variant="danger"
                onClick={confirming === "rotate" ? handleIssue : handleRevoke}
                disabled={isPending}
              >
                {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                {confirming === "rotate" ? "Выпустить новый" : "Отозвать"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                Отмена
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => setConfirming("rotate")}>
                <RefreshCw size={14} />
                Выпустить новый токен
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming("revoke")}>
                <ShieldOff size={14} />
                Отозвать доступ
              </Button>
            </>
          )}
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-[12px] text-negative" role="alert">
          {error}
        </p>
      ) : null}
    </Panel>
  );
}
