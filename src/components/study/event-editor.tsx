"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, TextInput, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PALETTE } from "@/config/palette";
import { createEvent, deleteEvent, updateEvent } from "@/lib/actions/events";
import type { CalendarEvent, IsoDate } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { formatDayMonth } from "@/lib/utils/date";

/**
 * Форма дела в календаре.
 *
 * Одно окно и на создание, и на редактирование. У редактирования повтора нет:
 * «повторить по неделям» создаёт независимые копии только при создании (см.
 * actions/events.ts) — трогать сразу всю серию нечем, у неё нет общего id.
 */

export interface EventEditorTarget {
  /** Дата, на которую открыли форму — по умолчанию для нового дела. */
  date: IsoDate;
  /** Существующее дело, если редактируем, иначе новое. */
  event: CalendarEvent | null;
  /** Клик по времени в сетке — час начала подставляется сразу, конец — +1 час. */
  defaultStartTime?: string;
}

/** "14:30" + час -> "15:30", с переносом через полночь. */
function addHour(time: string): string {
  const [hours = "0", minutes = "0"] = time.split(":");
  const total = (Number(hours) * 60 + Number(minutes) + 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

interface EventEditorProps {
  target: EventEditorTarget | null;
  onClose: () => void;
}

export function EventEditor({ target, onClose }: EventEditorProps) {
  if (!target) return null;

  // key пересоздаёт форму при смене цели — иначе поля новой формы унаследуют
  // значения от предыдущего дела (или от предыдущего слота в сетке времени).
  const key = target.event?.id ?? `${target.date}-${target.defaultStartTime ?? ""}`;
  return <EventForm key={key} target={target} onClose={onClose} />;
}

function EventForm({ target, onClose }: { target: EventEditorTarget; onClose: () => void }) {
  const { event, date, defaultStartTime } = target;

  const [draft, setDraft] = useState({
    date: event?.date ?? date,
    startTime: event?.startTime ?? defaultStartTime ?? "",
    endTime: event?.endTime ?? (defaultStartTime ? addHour(defaultStartTime) : ""),
    title: event?.title ?? "",
    location: event?.location ?? "",
    description: event?.description ?? "",
    color: event?.color ?? PALETTE[0]?.value ?? "#7e8894",
  });
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [repeatUntil, setRepeatUntil] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setError(null);

    // Время начала и конца — обе пустые (весь день) или обе заполнены:
    // наполовину указанное время нечего показывать в ленте календаря.
    if ((draft.startTime === "") !== (draft.endTime === "")) {
      setError("Укажите и начало, и конец, либо оставьте оба поля пустыми.");
      return;
    }

    if (repeatWeekly && !repeatUntil) {
      setError("Укажите, до какой даты повторять.");
      return;
    }

    startTransition(async () => {
      const input = {
        date: draft.date,
        startTime: draft.startTime,
        endTime: draft.endTime,
        title: draft.title,
        location: draft.location,
        description: draft.description,
        color: draft.color,
      };

      const result = event
        ? await updateEvent(event.id, input)
        : await createEvent(
            repeatWeekly ? { ...input, repeatWeeklyUntil: repeatUntil } : input,
          );

      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  function handleDelete() {
    if (!event) return;

    startTransition(async () => {
      const result = await deleteEvent(event.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={event ? "Изменить дело" : "Новое дело"}
      description={formatDayMonth(draft.date)}
      footer={
        <>
          {event ? (
            <Button type="button" variant="danger" onClick={handleDelete} disabled={isPending}>
              <Trash2 size={16} />
              Удалить
            </Button>
          ) : null}

          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>

          <Button type="submit" form="event-form" variant="primary" disabled={isPending}>
            {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
            Сохранить
          </Button>
        </>
      }
    >
      <form id="event-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Название">
          {(id) => (
            <TextInput
              id={id}
              value={draft.title}
              autoFocus
              maxLength={120}
              placeholder="Например: Доктор"
              onChange={(formEvent) => setDraft({ ...draft, title: formEvent.target.value })}
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Дата">
            {(id) => (
              <TextInput
                id={id}
                type="date"
                value={draft.date}
                onChange={(formEvent) => setDraft({ ...draft, date: formEvent.target.value })}
              />
            )}
          </Field>

          <Field label="Место" hint="Необязательно">
            {(id) => (
              <TextInput
                id={id}
                value={draft.location}
                placeholder="Клиника, room 304…"
                onChange={(formEvent) => setDraft({ ...draft, location: formEvent.target.value })}
              />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Начало" hint="Пусто — весь день">
            {(id) => (
              <TextInput
                id={id}
                type="time"
                value={draft.startTime}
                onChange={(formEvent) => setDraft({ ...draft, startTime: formEvent.target.value })}
              />
            )}
          </Field>

          <Field label="Конец">
            {(id) => (
              <TextInput
                id={id}
                type="time"
                value={draft.endTime}
                onChange={(formEvent) => setDraft({ ...draft, endTime: formEvent.target.value })}
              />
            )}
          </Field>
        </div>

        <Field label="Заметка" hint="Необязательно">
          {(id) => (
            <Textarea
              id={id}
              value={draft.description}
              maxLength={2000}
              rows={2}
              onChange={(formEvent) =>
                setDraft({ ...draft, description: formEvent.target.value })
              }
            />
          )}
        </Field>

        <div>
          <p className="mb-1.5 text-[12px] font-medium text-ink-muted">Цвет</p>
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((entry) => (
              <button
                key={entry.value}
                type="button"
                aria-label={entry.label}
                aria-pressed={draft.color === entry.value}
                title={entry.label}
                onClick={() => setDraft({ ...draft, color: entry.value })}
                className={cn(
                  "h-7 w-7 cursor-pointer rounded-full border-2 transition-transform duration-200",
                  draft.color === entry.value
                    ? "scale-110 border-ink"
                    : "border-transparent hover:scale-105",
                )}
                style={{ backgroundColor: entry.value }}
              />
            ))}
          </div>
        </div>

        {/* Повтор — только при создании: у уже сохранённых дел нет общей
            серии, которую можно было бы продлить или сдвинуть разом. */}
        {!event ? (
          <div className="rounded-[10px] border border-line bg-surface-2 px-3 py-2.5">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink">
              <input
                type="checkbox"
                checked={repeatWeekly}
                onChange={(formEvent) => setRepeatWeekly(formEvent.target.checked)}
                className="h-4 w-4 cursor-pointer accent-accent"
              />
              Повторять каждую неделю
            </label>

            {repeatWeekly ? (
              <div className="mt-2.5">
                <Field label="До какой даты" hideLabel>
                  {(id) => (
                    <TextInput
                      id={id}
                      type="date"
                      min={draft.date}
                      value={repeatUntil}
                      onChange={(formEvent) => setRepeatUntil(formEvent.target.value)}
                    />
                  )}
                </Field>
                <p className="mt-1.5 text-[11px] text-ink-faint">
                  Каждая неделя добавится отдельным делом — потом любое можно
                  отменить или подвинуть, не трогая остальные.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="text-[12px] text-negative" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
