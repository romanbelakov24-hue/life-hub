"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, Select, Textarea, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { createNote, deleteNote, updateNote } from "@/lib/actions/study";
import type { IsoDate, Note } from "@/lib/types";

/**
 * Форма заметки: заголовок, текст, дата и привязка к предмету.
 * Одно окно на создание и редактирование — отличается только тем,
 * какое действие вызывается при сохранении.
 */

interface NoteEditorProps {
  open: boolean;
  onClose: () => void;
  /** Редактируемая заметка; null — создание новой. */
  note: Note | null;
  subjects: string[];
  /** Дата по умолчанию для новой заметки. */
  today: IsoDate;
}

export function NoteEditor({ open, onClose, note, subjects, today }: NoteEditorProps) {
  if (!open) return null;

  return (
    <NoteEditorBody
      key={note?.id ?? "new"}
      onClose={onClose}
      note={note}
      subjects={subjects}
      today={today}
    />
  );
}

function NoteEditorBody({
  onClose,
  note,
  subjects,
  today,
}: Omit<NoteEditorProps, "open">) {
  const [draft, setDraft] = useState({
    title: note?.title ?? "",
    body: note?.body ?? "",
    date: note?.date ?? today,
    subject: note?.subject ?? "",
  });

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = note ? await updateNote(note.id, draft) : await createNote(draft);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  function handleDelete() {
    if (!note) return;

    startTransition(async () => {
      const result = await deleteNote(note.id);
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
      title={note ? "Изменить заметку" : "Новая заметка"}
      footer={
        <>
          {note ? (
            <Button type="button" variant="danger" onClick={handleDelete} disabled={isPending}>
              <Trash2 size={16} />
              Удалить
            </Button>
          ) : null}

          <Button type="button" variant="ghost" onClick={onClose}>
            Отмена
          </Button>

          <Button type="submit" form="note-form" variant="primary" disabled={isPending}>
            {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
            Сохранить
          </Button>
        </>
      }
    >
      <form id="note-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Заголовок">
          {(id) => (
            <TextInput
              id={id}
              value={draft.title}
              autoFocus
              maxLength={120}
              placeholder="О чём заметка"
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          )}
        </Field>

        <Field label="Текст">
          {(id) => (
            <Textarea
              id={id}
              value={draft.body}
              rows={7}
              placeholder="Конспект, формула, ссылка на материалы…"
              onChange={(event) => setDraft({ ...draft, body: event.target.value })}
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
                onChange={(event) => setDraft({ ...draft, date: event.target.value })}
              />
            )}
          </Field>

          <Field label="Предмет">
            {(id) => (
              <Select
                id={id}
                value={draft.subject}
                onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
              >
                <option value="">Без предмета</option>
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
                {/* Предмет мог исчезнуть из расписания — сохраняем как есть. */}
                {draft.subject && !subjects.includes(draft.subject) ? (
                  <option value={draft.subject}>{draft.subject}</option>
                ) : null}
              </Select>
            )}
          </Field>
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
