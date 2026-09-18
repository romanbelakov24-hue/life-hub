"use client";

import {
  CalendarDays,
  Check,
  ExternalLink,
  ListTodo,
  Loader2,
  Mic,
  Send,
  StickyNote,
  Sun,
  Unlink,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Panel, PanelHeader } from "@/components/ui/panel";
import {
  getTelegramPanel,
  saveTelegramDigest,
  sendTelegramDigestNow,
  startTelegramLink,
  unlinkTelegram,
} from "@/lib/actions/telegram";
import type { TelegramPanelState } from "@/lib/telegram/panel";
import { cn } from "@/lib/utils/cn";

/**
 * Панель общего Telegram-бота.
 *
 * Привязка без ввода кодов руками: кнопка выдаёт одноразовую ссылку
 * t.me/<бот>?start=<код>, Telegram открывает чат, человек жмёт «Start» — и бот
 * сам привязывает чат к аккаунту. Панель тем временем опрашивает сервер и
 * переключается в «подключено», как только привязка случилась.
 */

interface TelegramBotProps {
  initial: TelegramPanelState;
  index?: number;
}

const POLL_INTERVAL_MS = 3000;
const POLL_LIMIT_MS = 15 * 60_000;

/** Время сводки — любое в сутках шагом 15 минут: чаще расписание воркера не срабатывает. */
const DIGEST_TIMES = Array.from({ length: 24 * 4 }, (_, index) => {
  const minutes = index * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

/** Сохранённое время, которого нет в списке (задано до смены шага), всё равно видно. */
function timeOptions(current: string): string[] {
  return DIGEST_TIMES.includes(current) ? DIGEST_TIMES : [...DIGEST_TIMES, current].sort();
}

const KIND_ICON = {
  task: ListTodo,
  event: CalendarDays,
  expense: Wallet,
  note: StickyNote,
} as const;

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Moscow";
  } catch {
    return "Europe/Moscow";
  }
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatLinkedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/** Два сообщения-примера — как будет выглядеть переписка с ботом. */
function ChatPreview() {
  const pairs = [
    { user: "завтра в 15:00 созвон с Лизой", bot: "📅 В календарь — Созвон с Лизой · завтра, 15:00–16:00" },
    { user: "кофе 250", bot: "💸 Трата — 250 ₽ · Еда" },
  ];
  return (
    <div className="glass-recessed flex flex-col gap-2 rounded-[14px] border border-line bg-surface-2 p-3">
      {pairs.map((pair) => (
        <div key={pair.user} className="flex flex-col gap-1.5">
          <p className="ml-auto max-w-[85%] rounded-[14px] rounded-br-[4px] bg-accent px-3 py-1.5 text-[12.5px] leading-snug text-accent-ink">
            {pair.user}
          </p>
          <p className="glass-inset mr-auto max-w-[85%] rounded-[14px] rounded-bl-[4px] border border-line bg-surface px-3 py-1.5 text-[12.5px] leading-snug text-ink">
            {pair.bot}
          </p>
        </div>
      ))}
      <p className="flex items-center justify-center gap-1.5 pt-0.5 text-[11.5px] text-ink-faint">
        <Mic size={12} /> Голосовые тоже — бот расшифрует сам
      </p>
    </div>
  );
}

export function TelegramBot({ initial, index }: TelegramBotProps) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [digestSent, setDigestSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const pollStarted = useRef(0);

  useEffect(() => setState(initial), [initial]);

  // Пока ждём «Start» в Telegram — спрашиваем сервер, не привязался ли чат.
  useEffect(() => {
    if (!pendingUrl || state.link) return;
    pollStarted.current = Date.now();
    const timer = window.setInterval(async () => {
      if (Date.now() - pollStarted.current > POLL_LIMIT_MS) {
        window.clearInterval(timer);
        setPendingUrl(null);
        return;
      }
      const result = await getTelegramPanel();
      if (result.ok && result.data.link) {
        window.clearInterval(timer);
        setState(result.data);
        setPendingUrl(null);
        router.refresh();
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [pendingUrl, state.link, router]);

  function handleConnect() {
    setError(null);
    // Окно открывается синхронно, прямо в обработчике клика: окно, открытое
    // после await, браузеры (особенно Safari на iPhone) считают всплывающим и
    // блокируют. Адрес подставляется, когда сервер выдаст ссылку.
    const opened = window.open("", "_blank");
    startTransition(async () => {
      const result = await startTelegramLink(browserTimeZone());
      if (!result.ok) {
        opened?.close();
        setError(result.error);
        return;
      }
      setPendingUrl(result.data.url);
      if (opened) opened.location.href = result.data.url;
    });
  }

  function saveDigest(next: { enabled: boolean; time: string }) {
    if (!state.link) return;
    const previous = state.link;
    setError(null);
    setState((current) =>
      current.link ? { ...current, link: { ...current.link, digestEnabled: next.enabled, digestTime: next.time } } : current,
    );
    startTransition(async () => {
      const result = await saveTelegramDigest({ ...next, timeZone: browserTimeZone() });
      if (!result.ok) {
        setError(result.error);
        setState((current) => ({ ...current, link: previous }));
      }
    });
  }

  function handleSendNow() {
    setError(null);
    startTransition(async () => {
      const result = await sendTelegramDigestNow();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDigestSent(true);
      window.setTimeout(() => setDigestSent(false), 2500);
    });
  }

  function handleUnlink() {
    setError(null);
    startTransition(async () => {
      const result = await unlinkTelegram();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirmUnlink(false);
      setState((current) => ({ ...current, link: null }));
      router.refresh();
    });
  }

  const link = state.link;
  const handle = `@${state.botUsername}`;

  return (
    <Panel index={index}>
      <div id="telegram" className="scroll-mt-24" />
      <PanelHeader
        eyebrow="Интеграции"
        title="Telegram-бот"
        description="Пиши или надиктовывай — бот запишет задачи, дела, траты и заметки, а по утрам пришлёт сводку дня"
        actions={
          link ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-positive-soft px-2.5 py-1 text-[12px] font-medium text-positive">
              <span className="h-1.5 w-1.5 rounded-full bg-positive" />
              Подключён
            </span>
          ) : null
        }
      />

      {!state.configured ? (
        <p className="mt-4 rounded-[10px] bg-warning-soft px-3 py-2.5 text-[12px] leading-relaxed text-warning">
          Бот пока выключен на сервере: не задан TELEGRAM_BOT_TOKEN.
        </p>
      ) : link ? (
        <div className="mt-4 flex flex-col gap-4">
          {/* Кто привязан */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="glass-inset flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Send size={17} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-ink">
                  {link.username ? `@${link.username}` : link.firstName || "Telegram"}
                </p>
                <p className="text-[12px] text-ink-faint">
                  Чат с{" "}
                  <a href={state.botUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    {handle}
                  </a>
                  {link.linkedAt ? ` · с ${formatLinkedAt(link.linkedAt)}` : ""}
                </p>
              </div>
            </div>
            <a
              href={state.botUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              Открыть чат <ExternalLink size={13} />
            </a>
          </div>

          {/* Утренняя сводка */}
          <div className="glass-recessed rounded-[14px] border border-line bg-surface-2 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <Sun size={16} className="mt-0.5 shrink-0 text-accent" />
                <div>
                  <p className="text-[14px] font-medium text-ink">Сводка дня</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-ink-muted">
                    Дела из календаря, задачи на сегодня, просроченное и дедлайны недели. Без денег.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={link.digestEnabled}
                aria-label="Присылать утреннюю сводку"
                onClick={() => saveDigest({ enabled: !link.digestEnabled, time: link.digestTime })}
                disabled={isPending}
                className={cn(
                  "relative h-7 w-12 shrink-0 cursor-pointer rounded-full border transition-colors duration-300",
                  link.digestEnabled
                    ? "border-transparent bg-accent shadow-[0_0_20px_-4px_var(--glow-strong)]"
                    : "border-line bg-surface",
                )}
              >
                <span
                  className={cn(
                    "absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all duration-300",
                    link.digestEnabled ? "left-[26px] bg-accent-ink" : "left-[3px] bg-ink-faint",
                  )}
                />
              </button>
            </div>

            {link.digestEnabled ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <label htmlFor="digest-time" className="text-[12.5px] text-ink-muted">
                  Присылать в
                </label>
                <Select
                  id="digest-time"
                  value={link.digestTime}
                  onChange={(event) => saveDigest({ enabled: true, time: event.target.value })}
                  disabled={isPending}
                  className="h-9 w-[112px] font-mono text-[13px]"
                >
                  {timeOptions(link.digestTime).map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </Select>
                <span className="text-[12px] text-ink-faint">{link.timezone.replace(/_/g, " ")}</span>
                <Button size="sm" variant="ghost" onClick={handleSendNow} disabled={isPending} className="ml-auto">
                  {digestSent ? <Check size={14} /> : <Send size={14} />}
                  {digestSent ? "Отправлено" : "Прислать сейчас"}
                </Button>
              </div>
            ) : null}
          </div>

          {/* Недавно из Telegram */}
          <div>
            <p className="eyebrow mb-2">Недавно из Telegram</p>
            {state.recent.length > 0 ? (
              <ul className="flex flex-col">
                {state.recent.map((item) => {
                  const Icon = KIND_ICON[item.resultKind as keyof typeof KIND_ICON] ?? Send;
                  return (
                    <li
                      key={item.updateId}
                      className="flex items-center gap-2.5 border-b border-line py-2 text-[13px] last:border-b-0"
                    >
                      <Icon size={14} className="shrink-0 text-ink-faint" />
                      <span className={cn("min-w-0 flex-1 truncate text-ink", item.undone && "text-ink-faint line-through")}>
                        {item.summary}
                      </span>
                      {item.inputKind === "voice" ? <Mic size={12} className="shrink-0 text-ink-faint" /> : null}
                      <span className="shrink-0 font-mono text-[11px] text-ink-faint">
                        {item.undone ? "отменено" : formatWhen(item.receivedAt)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-muted">
                Пока пусто — напиши боту, например, «сдать эссе до пятницы».
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            {confirmUnlink ? (
              <>
                <span className="text-[12px] text-ink-muted">
                  Бот перестанет записывать и присылать сводки. Отвязать?
                </span>
                <Button size="sm" variant="danger" onClick={handleUnlink} disabled={isPending}>
                  {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                  Отвязать
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmUnlink(false)}>
                  Отмена
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmUnlink(true)}>
                <Unlink size={14} />
                Отвязать Telegram
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_minmax(0,300px)] sm:items-center">
          <div className="flex flex-col items-start gap-3">
            <ol className="flex flex-col gap-1.5 text-[13px] leading-snug text-ink-muted">
              <li>1. Нажми «Подключить» — откроется чат с {handle}.</li>
              <li>2. В Telegram нажми «Start».</li>
              <li>3. Всё — пиши или надиктовывай, бот сам поймёт, что записать.</li>
            </ol>

            {pendingUrl ? (
              <div className="flex flex-col items-start gap-2">
                <p className="flex items-center gap-2 text-[13px] text-ink">
                  <Loader2 size={14} className="animate-spin text-accent" />
                  Ждём «Start» в Telegram…
                </p>
                <a
                  href={pendingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12.5px] text-accent hover:underline"
                >
                  Telegram не открылся? Открыть ссылку <ExternalLink size={12} />
                </a>
                <p className="text-[11.5px] text-ink-faint">Ссылка одноразовая и действует 15 минут.</p>
              </div>
            ) : (
              <Button variant="primary" onClick={handleConnect} disabled={isPending}>
                {isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Подключить Telegram
              </Button>
            )}
          </div>

          <ChatPreview />
        </div>
      )}

      {error ? (
        <p className="mt-3 text-[12px] text-negative" role="alert">
          {error}
        </p>
      ) : null}
    </Panel>
  );
}
