"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { DEFAULT_PAIR_TIMES } from "@/config/schedule";
import { PALETTE } from "@/config/palette";
import { deleteScheduleSlot, saveScheduleSlot } from "@/lib/actions/study";
import type { ScheduleSlot, Weekday } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { WEEKDAY_NAMES } from "@/lib/utils/date";

/**
 * Форма пары в расписании.
 *
 * Одно окно работает и на создание, и на редактирование: ячейка сетки
 * уникальна (день × номер пары), поэтому сохранение всегда «перезаписывает
 * ячейку» — см. saveScheduleSlot с ON CONFLICT в actions/study.ts.
 */

export interface SlotEditorTarget {
  weekday: Weekday;
  pairIndex: number;
  /** Существующая пара, если ячейка занята. */
  slot: ScheduleSlot | null;
}

interface ScheduleSlotEditorProps {
  target: SlotEditorTarget | null;
  onClose: () => void;
}

export function ScheduleSlotEditor({ target, onClose }: ScheduleSlotEditorProps) {
  if (!target) return null;

  // key заставляет форму пересоздаться при переходе к другой ячейке —
  // иначе в полях останутся значения от предыдущей пары.
  return (
    <SlotForm
      key={`${target.weekday}-${target.pairIndex}`}
      target={target}
      onClose={onClose}
    />
  );
}

function SlotForm({ target, onClose }: { target: SlotEditorTarget; onClose: () => void }) {
  const { slot, weekday, pairIndex } = target;
  const defaults = DEFAULT_PAIR_TIMES[pairIndex] ?? { start: "", end: "" };

  const [draft, setDraft] = useState({
    subject: slot?.subject ?? "",
    room: slot?.room ?? "",
    teacher: slot?.teacher ?? "",
    startTime: slot?.startTime ?? "",
    endTime: slot?.endTime ?? "",
    color: slot?.color ?? PALETTE[0]?.value ?? "#7e8894",
  });

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await saveScheduleSlot({
        weekday,
        pairIndex,
        subject: draft.subject,
        room: draft.room,
        teacher: draft.teacher,
        startTime: draft.startTime,
        endTime: draft.endTime,
        color: draft.color,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  function handleDelete() {
    if (!slot) return;

    startTransition(async () => {
      const result = await deleteScheduleSlot(slot.id);
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
      title={slot ? "Изменить пару" : "Добавить пару"}
      description={`${WEEKDAY_NAMES[weekday]}, ${pairIndex}-я пара`}
      footer={
        <>
          {slot ? (
            <Button type="button" variant="danger" onClick={handleDelete} disabled={isPending}>
              <Trash2 size={16} />
              Удалить
            </Button>
          ) : null}

          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>

          <Button type="submit" form="slot-form" variant="primary" disabled={isPending}>
            {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
            Сохранить
          </Button>
        </>
      }
    >
      <form id="slot-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Предмет">
          {(id) => (
            <TextInput
              id={id}
              value={draft.subject}
              autoFocus
              maxLength={80}
              placeholder="Например: Матанализ"
              onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Аудитория">
            {(id) => (
              <TextInput
                id={id}
                value={draft.room}
                placeholder="304"
                onChange={(event) => setDraft({ ...draft, room: event.target.value })}
              />
            )}
          </Field>

          <Field label="Преподаватель">
            {(id) => (
              <TextInput
                id={id}
                value={draft.teacher}
                placeholder="Иванов И. И."
                onChange={(event) => setDraft({ ...draft, teacher: event.target.value })}
              />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Начало" hint={`по умолчанию ${defaults.start}`}>
            {(id) => (
              <TextInput
                id={id}
                type="time"
                value={draft.startTime}
                onChange={(event) => setDraft({ ...draft, startTime: event.target.value })}
              />
            )}
          </Field>

          <Field label="Конец" hint={`по умолчанию ${defaults.end}`}>
            {(id) => (
              <TextInput
                id={id}
                type="time"
                value={draft.endTime}
                onChange={(event) => setDraft({ ...draft, endTime: event.target.value })}
              />
            )}
          </Field>
        </div>

        <div>
          <p className="mb-1.5 text-[12px] font-medium text-ink-muted">Цвет предмета</p>
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

        {error ? (
          <p className="text-[12px] text-negative" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
