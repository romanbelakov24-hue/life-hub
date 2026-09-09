"use client";

import { NotebookPen, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { NoteEditor } from "@/components/study/note-editor";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/misc";
import { Panel } from "@/components/ui/panel";
import { colorFromString } from "@/config/palette";
import type { IsoDate, Note } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { formatDayMonth } from "@/lib/utils/date";

/**
 * Доска заметок.
 *
 * Фильтр по предмету и поиск по тексту работают на клиенте: заметок у одного
 * человека немного, и мгновенный отклик здесь важнее, чем экономия на памяти.
 * Если их станет тысячи — фильтрацию имеет смысл перенести в SQL-запрос
 * (см. listNotes в lib/queries/study.ts, он уже принимает предмет).
 */

interface NotesBoardProps {
  notes: Note[];
  /** Предметы из расписания — для фильтра и формы. */
  subjects: string[];
  today: IsoDate;
}

const ALL_SUBJECTS = "__all__";

export function NotesBoard({ notes, subjects, today }: NotesBoardProps) {
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState(ALL_SUBJECTS);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // В фильтре показываем и предметы из расписания, и те, что встречаются
  // только в заметках (предмет мог быть удалён из сетки).
  const filterSubjects = useMemo(() => {
    const fromNotes = notes.map((note) => note.subject).filter(Boolean);
    return [...new Set([...subjects, ...fromNotes])].sort((a, b) => a.localeCompare(b));
  }, [notes, subjects]);

  const visibleNotes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return notes.filter((note) => {
      const matchesSubject =
        subjectFilter === ALL_SUBJECTS || note.subject === subjectFilter;

      const matchesQuery =
        !normalizedQuery ||
        note.title.toLowerCase().includes(normalizedQuery) ||
        note.body.toLowerCase().includes(normalizedQuery);

      return matchesSubject && matchesQuery;
    });
  }, [notes, query, subjectFilter]);

  function openEditor(note: Note | null) {
    setEditingNote(note);
    setIsEditorOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Поиск и создание */}
      <div className="flex gap-2">
        <Field label="Поиск по заметкам" hideLabel className="flex-1">
          {(id) => (
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
                <Search size={15} />
              </span>
              <TextInput
                id={id}
                type="search"
                value={query}
                placeholder="Поиск по заголовку и тексту"
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9"
              />
            </div>
          )}
        </Field>

        <Button variant="primary" onClick={() => openEditor(null)}>
          <Plus size={16} />
          <span className="hidden sm:inline">Заметка</span>
        </Button>
      </div>

      {/* Фильтр по предметам */}
      {filterSubjects.length > 0 ? (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <FilterChip
            active={subjectFilter === ALL_SUBJECTS}
            onClick={() => setSubjectFilter(ALL_SUBJECTS)}
          >
            Все
          </FilterChip>

          {filterSubjects.map((subject) => (
            <FilterChip
              key={subject}
              active={subjectFilter === subject}
              color={colorFromString(subject)}
              onClick={() => setSubjectFilter(subject)}
            >
              {subject}
            </FilterChip>
          ))}
        </div>
      ) : null}

      {visibleNotes.length === 0 ? (
        <Panel>
          <EmptyState
            icon={NotebookPen}
            title={notes.length === 0 ? "Заметок пока нет" : "Ничего не найдено"}
            description={
              notes.length === 0
                ? "Сюда удобно складывать конспекты, формулы и всё, что нужно не забыть."
                : "Попробуйте изменить запрос или снять фильтр по предмету."
            }
            action={
              notes.length === 0 ? (
                <Button variant="primary" size="sm" onClick={() => openEditor(null)}>
                  <Plus size={15} />
                  Создать заметку
                </Button>
              ) : undefined
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleNotes.map((note) => (
            <NoteCard key={note.id} note={note} onClick={() => openEditor(note)} />
          ))}
        </div>
      )}

      <NoteEditor
        open={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        note={editingNote}
        subjects={filterSubjects}
        today={today}
      />
    </div>
  );
}

/** Карточка заметки: цветная полоса предмета + заголовок + начало текста. */
function NoteCard({ note, onClick }: { note: Note; onClick: () => void }) {
  const accent = note.subject ? colorFromString(note.subject) : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      data-spotlight
      className={cn(
        "glass glass-blur spotlight relative flex cursor-pointer flex-col rounded-[14px] border border-line bg-surface/88 p-4 text-left",
        "transition-[border-color,transform] duration-200 hover:border-line-strong hover:-translate-y-0.5",
      )}
      style={accent ? { borderTop: `3px solid ${accent}` } : undefined}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="tabular text-[11px] text-ink-faint">{formatDayMonth(note.date)}</span>
        {note.subject ? (
          <span className="truncate text-[11px] font-medium" style={{ color: accent }}>
            {note.subject}
          </span>
        ) : null}
      </div>

      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-ink">
        {note.title || "Без заголовка"}
      </p>

      {note.body ? (
        <p className="mt-1.5 line-clamp-5 whitespace-pre-line text-[13px] leading-snug text-ink-muted">
          {note.body}
        </p>
      ) : null}
    </button>
  );
}

function FilterChip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3",
        "text-[13px] transition-colors duration-200",
        active
          ? "border-ink bg-ink text-paper"
          : "border-line bg-surface text-ink-muted hover:text-ink",
      )}
    >
      {color ? (
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: active ? "currentColor" : color }}
          aria-hidden
        />
      ) : null}
      {children}
    </button>
  );
}
