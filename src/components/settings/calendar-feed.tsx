"use client";

import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { regenerateCalendarToken } from "@/lib/actions/settings";
import { cn } from "@/lib/utils/cn";

/**
 * Блок подписки на календарь: адрес ленты, кнопка копирования и инструкции
 * для Apple Calendar и Google Calendar.
 *
 * Адрес приходит с сервера готовым — компонент не собирает его из window,
 * иначе разметка сервера и клиента разошлись бы при гидрации.
 */

interface CalendarFeedProps {
  feedUrl: string;
  index?: number;
}

export function CalendarFeed({ feedUrl, index }: CalendarFeedProps) {
  const [url, setUrl] = useState(feedUrl);
  const [copied, setCopied] = useState(false);
  const [confirmingRotate, setConfirmingRotate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Буфер обмена недоступен (нет https или запрещено политикой) —
      // выделяем текст, чтобы адрес можно было скопировать вручную.
      setError("Не удалось скопировать. Выделите адрес и скопируйте вручную.");
    }
  }

  function handleRotate() {
    setError(null);
    startTransition(async () => {
      const result = await regenerateCalendarToken();

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Меняем только токен в конце адреса — остальная часть не изменилась.
      setUrl((current) => current.replace(/[^/]+$/, `${result.data.token}.ics`));
      setConfirmingRotate(false);
    });
  }

  return (
    <Panel index={index}>
      <PanelHeader
        eyebrow="Календарь"
        title="Подписка на расписание"
        description="Пары и дедлайны задач появятся в системном календаре и будут обновляться сами"
      />

      {/* Адрес ленты */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <code
          className="min-w-0 flex-1 overflow-x-auto rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 font-mono text-[12px] text-ink-muted"
          // Одной строкой с горизонтальной прокруткой: перенос длинного адреса
          // мешает выделить его целиком.
          style={{ whiteSpace: "nowrap" }}
        >
          {url}
        </code>

        <Button onClick={handleCopy} variant={copied ? "outline" : "primary"} className="shrink-0">
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Скопировано" : "Копировать"}
        </Button>
      </div>

      {error ? (
        <p className="mt-2 text-[12px] text-negative" role="alert">
          {error}
        </p>
      ) : null}

      {/* Инструкции */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Instruction
          title="Apple Календарь"
          steps={[
            "На Mac: Файл → Новая подписка на календарь",
            "На iPhone: Настройки → Приложения → Календарь → Учётные записи → Другое → Подписной календарь",
            "Вставить адрес. Снять галочку «Удалить напоминания», чтобы приходили уведомления",
          ]}
        />
        <Instruction
          title="Google Календарь"
          steps={[
            "Открыть calendar.google.com на компьютере",
            "Слева: Другие календари → + → Добавить по URL",
            "Вставить адрес и нажать «Добавить календарь»",
          ]}
        />
      </div>

      <p className="mt-4 rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12px] leading-relaxed text-ink-muted">
        Синхронизация односторонняя: изменения из life hub попадают в календарь,
        обратно — нет. Google обновляет подписки редко, обычно раз в сутки, и
        повлиять на это со стороны сервера нельзя. Apple перечитывает чаще и
        позволяет задать интервал вручную.
      </p>

      {/* Смена адреса */}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {confirmingRotate ? (
          <>
            <span className="text-[12px] text-ink-muted">
              Прежние подписки перестанут обновляться. Продолжить?
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
          <>
            <Button size="sm" variant="ghost" onClick={() => setConfirmingRotate(true)}>
              <RefreshCw size={14} />
              Сменить адрес
            </Button>
            <span className="text-[12px] text-ink-faint">
              Нужно, только если адрес куда-то утёк
            </span>
          </>
        )}
      </div>
    </Panel>
  );
}

function Instruction({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className={cn("rounded-[12px] border border-line p-3.5")}>
      <p className="text-[13px] font-semibold text-ink">{title}</p>
      <ol className="mt-2 flex flex-col gap-1.5">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-2 text-[12px] leading-snug text-ink-muted">
            <span className="tabular shrink-0 text-ink-faint">{index + 1}.</span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}
