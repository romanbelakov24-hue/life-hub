"use client";

import { ArrowUpRight, Send, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Panel } from "@/components/ui/panel";

/**
 * Подсказка на обзоре: «подключи Telegram-бота». Видна, пока чат не привязан;
 * крестик прячет её на этом устройстве (localStorage) — навязываться тем, кому
 * бот не нужен, незачем, а в настройках кнопка остаётся всегда.
 */

const DISMISS_KEY = "life-hub:telegram-hint-dismissed";

export function TelegramHint({ botUsername }: { botUsername: string }) {
  // До чтения localStorage не рисуем ничего — иначе у закрывших подсказку она
  // мелькала бы на каждом открытии обзора.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(DISMISS_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Приватный режим — подсказка просто вернётся в следующий раз.
    }
  }

  if (!visible) return null;

  return (
    <Panel className="mb-4 flex items-center gap-3 !py-3">
      <span className="glass-inset flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Send size={16} />
      </span>
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink-muted">
        <span className="font-medium text-ink">Записывай из Telegram.</span> Напиши или надиктуй
        @{botUsername} — дела, задачи и траты появятся здесь, а утром придёт сводка дня.
      </p>
      <Link
        href="/settings#telegram"
        className="flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-[12.5px] font-medium text-accent transition-colors hover:bg-accent-soft"
      >
        Подключить
        <ArrowUpRight size={14} />
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Скрыть подсказку"
        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <X size={15} />
      </button>
    </Panel>
  );
}
