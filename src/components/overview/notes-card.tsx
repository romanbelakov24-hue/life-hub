import { ArrowUpRight, NotebookPen } from "lucide-react";
import Link from "next/link";

import { Panel, PanelHeader } from "@/components/ui/panel";
import { colorFromString } from "@/config/palette";
import type { Note } from "@/lib/types";
import { formatDayMonthShort } from "@/lib/utils/date";

/** Последние изменённые заметки — быстрый доступ к тому, что писалось недавно. */

export function NotesCard({ notes, index }: { notes: Note[]; index?: number }) {
  return (
    <Panel className="flex flex-col" index={index}>
      <PanelHeader
        eyebrow="Учёба"
        title="Свежие заметки"
        actions={
          <Link
            href="/notes"
            className="flex h-9 cursor-pointer items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-ink-muted transition-colors duration-200 hover:text-accent"
          >
            Все заметки
            <ArrowUpRight size={14} />
          </Link>
        }
      />

      {notes.length === 0 ? (
        <p className="mt-4 flex flex-1 items-center gap-2 rounded-[10px] bg-surface-2 px-3 py-3 text-[12px] text-ink-muted">
          <NotebookPen size={14} className="shrink-0" />
          Заметок пока нет.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">
          {notes.map((note) => (
            <li key={note.id} className="flex items-start gap-2.5">
              <span
                className="mt-1 h-8 w-[3px] shrink-0 rounded-full"
                style={{
                  backgroundColor: note.subject
                    ? colorFromString(note.subject)
                    : "var(--line-strong)",
                }}
                aria-hidden
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">
                  {note.title || "Без заголовка"}
                </p>
                <p className="truncate text-[11px] text-ink-faint">
                  {[note.subject, formatDayMonthShort(note.date)].filter(Boolean).join(" · ")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
