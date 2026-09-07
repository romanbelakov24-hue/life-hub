import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/app-shell";
import { NotesBoard } from "@/components/study/notes-board";
import { requireUser } from "@/lib/auth/user";
import { listNotes, listSubjects } from "@/lib/queries/study";
import { todayIso } from "@/lib/utils/date";
import { pluralize } from "@/lib/utils/format";

/** Страница «Заметки». Поиск и фильтрация выполняются в NotesBoard на клиенте. */

export const metadata: Metadata = { title: "Заметки" };

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const user = await requireUser();
  const today = todayIso();

  const [notes, subjects] = await Promise.all([listNotes(user.id), listSubjects(user.id)]);

  return (
    <>
      <PageHeader
        eyebrow="Учёба"
        title="Заметки"
        description={
          notes.length === 0
            ? "Конспекты, формулы и напоминания по предметам"
            : `${notes.length} ${pluralize(notes.length, "заметка", "заметки", "заметок")}`
        }
      />

      <NotesBoard notes={notes} subjects={subjects} today={today} />
    </>
  );
}
