"use client";

import { Check, Loader2, Smartphone } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { logScreenTime } from "@/lib/actions/health";
import type { IsoDate } from "@/lib/types";

/**
 * Ручной ввод экранного времени.
 *
 * Единственный показатель на этой странице без автоматизации: у Apple нет
 * действия Shortcuts, которое читало бы Экранное время так же, как шаги или
 * сон — это отдельный API с ограниченным доступом. Так что вместо вебхука —
 * обычная форма, как и с остальным в приложении: посмотрел в Настройках на
 * телефоне, занёс сюда.
 */

interface ScreenTimeLogProps {
  today: IsoDate;
  index?: number;
}

export function ScreenTimeLog({ today, index }: ScreenTimeLogProps) {
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    const parsedHours = hours.trim() === "" ? 0 : Number(hours);
    const parsedMinutes = minutes.trim() === "" ? 0 : Number(minutes);

    if (!Number.isFinite(parsedHours) || !Number.isFinite(parsedMinutes)) {
      setError("Часы и минуты должны быть числами.");
      return;
    }
    const total = parsedHours * 60 + parsedMinutes;
    if (total <= 0) {
      setError("Укажите хотя бы несколько минут.");
      return;
    }

    startTransition(async () => {
      const result = await logScreenTime({ date, minutes: total });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <Panel index={index}>
      <PanelHeader
        eyebrow="Вручную"
        title="Экранное время"
        description="Из Настроек телефона — Экранное время → сегодня"
      />

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
          <Field label="Часы" className="w-24">
            {(id) => (
              <TextInput
                id={id}
                type="number"
                inputMode="numeric"
                min={0}
                max={23}
                value={hours}
                placeholder="2"
                onChange={(event) => {
                  setHours(event.target.value);
                  setSaved(false);
                }}
              />
            )}
          </Field>

          <Field label="Минуты" className="w-24">
            {(id) => (
              <TextInput
                id={id}
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                value={minutes}
                placeholder="30"
                onChange={(event) => {
                  setMinutes(event.target.value);
                  setSaved(false);
                }}
              />
            )}
          </Field>

          <Field label="Дата" className="flex-1 sm:max-w-[160px]">
            {(id) => (
              <TextInput
                id={id}
                type="date"
                max={today}
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setSaved(false);
                }}
              />
            )}
          </Field>

          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : saved ? (
              <Check size={16} />
            ) : (
              <Smartphone size={16} />
            )}
            {saved ? "Сохранено" : "Сохранить"}
          </Button>
        </div>

        {error ? (
          <p className="text-[12px] text-negative" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Panel>
  );
}
