"use client";

import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { regenerateHealthToken } from "@/lib/actions/settings";
import { cn } from "@/lib/utils/cn";

/**
 * Приём данных здоровья из «Быстрых команд» на iPhone.
 *
 * У Apple Health нет веб-API — обойти это можно только через автоматизацию:
 * она сама читает Здоровье на устройстве и раз в день отправляет сюда то,
 * что нашла, обычным POST-запросом. Здесь — адрес для этого запроса и
 * пошаговая настройка автоматизации, с телом запроса, которое ждёт наш
 * собственный приёмник (см. src/app/api/health/[token]/route.ts).
 */

interface HealthExportProps {
  webhookUrl: string;
}

export function HealthExport({ webhookUrl }: HealthExportProps) {
  const [url, setUrl] = useState(webhookUrl);
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
      setError("Не удалось скопировать. Выделите адрес и скопируйте вручную.");
    }
  }

  function handleRotate() {
    setError(null);
    startTransition(async () => {
      const result = await regenerateHealthToken();

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setUrl((current) => current.replace(/[^/]+$/, result.data.token));
      setConfirmingRotate(false);
    });
  }

  return (
    <Panel index={0}>
      <PanelHeader
        eyebrow="Приём данных"
        title="Настройка «Быстрых команд»"
        description="Автоматизация на iPhone раз в день отправляет сюда шаги, сон и пульс"
      />

      {/* Адрес вебхука */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <code
          className="min-w-0 flex-1 overflow-x-auto rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 font-mono text-[12px] text-ink-muted"
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

      {/* Пошаговая настройка */}
      <ol className="mt-5 flex flex-col gap-3">
        <Step number={1} title="Создайте автоматизацию">
          Быстрые команды → вкладка «Автоматизация» → «+» → «Создать личную
          автоматизацию» → «Время суток» (например, 22:00, повтор — каждый
          день).
        </Step>

        <Step number={2} title="Считайте показатели из Здоровья">
          Добавьте действие «Работоспособность» → «Найти образцы здоровья, где»
          для каждого показателя отдельно: категория «Число шагов» за
          сегодня, «Продолжительность сна в постели» за прошлую ночь, «Пульс в
          состоянии покоя» за сегодня. После каждого поиска — действие
          «Получить сведения об образце здоровья», параметр «Количество».
        </Step>

        <Step number={3} title="Соберите тело запроса">
          Добавьте действие «Словарь»: ключ <code className="tabular">steps</code> —
          значение из первого шага, <code className="tabular">sleepMinutes</code> —
          сон в минутах (Быстрые команды считают сон в часах — умножьте на 60
          действием «Вычислить»), <code className="tabular">restingHeartRate</code> —
          пульс. Любое поле можно пропустить, если показателя нет на этом
          устройстве.
        </Step>

        <Step number={4} title="Отправьте запрос">
          Действие «Получить содержимое URL»: адрес — тот, что скопирован
          выше; метод — <code className="tabular">POST</code>; тело запроса —
          JSON, содержимое — Словарь из предыдущего шага. Заголовок{" "}
          <code className="tabular">Content-Type: application/json</code>{" "}
          Быстрые команды подставляют сами при выборе JSON.
        </Step>

        <Step number={5} title="Отключите подтверждение" last>
          В настройках автоматизации выключите «Спрашивать перед запуском» —
          иначе она не сработает по расписанию без вас.
        </Step>
      </ol>

      <div className="mt-5 rounded-[10px] bg-surface-2 px-3 py-2.5">
        <p className="mb-1.5 text-[11px] font-medium text-ink-muted">
          Пример тела запроса
        </p>
        <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-ink-faint">
{`{
  "steps": 8342,
  "sleepMinutes": 411,
  "restingHeartRate": 58
}`}
        </pre>
      </div>

      <p className="mt-4 rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12px] leading-relaxed text-ink-muted">
        Даты нет в примере намеренно: если её не прислать, запись пойдёт на
        сегодня — обычный случай для автоматизации, запускаемой вечером.
        Каждое поле независимо: одна автоматизация может слать только шаги,
        другая — только сон, они не затирают друг друга.
      </p>

      {/* Смена адреса */}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {confirmingRotate ? (
          <>
            <span className="text-[12px] text-ink-muted">
              Автоматизацию придётся перенастроить на новый адрес. Продолжить?
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

function Step({
  number,
  title,
  children,
  last = false,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <li className={cn("flex gap-3", !last && "pb-3")}>
      <span className="tabular mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[12px] font-semibold text-ink-muted">
        {number}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink">{title}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{children}</p>
      </div>
    </li>
  );
}
