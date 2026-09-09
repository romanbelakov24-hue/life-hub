"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { EventEditor, type EventEditorTarget } from "@/components/study/event-editor";
import { TimeGrid } from "@/components/study/time-grid";
import type { CalendarEvent, IsoDate } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  formatDayMonth,
  formatMonthTitle,
  startOfMonth,
  startOfWeek,
  todayIso,
  WEEKDAY_NAMES,
  WEEKDAY_SHORT,
  weekdayOf,
} from "@/lib/utils/date";

/**
 * Календарь дел — три вида, как в Apple Calendar: месяц, неделя, день.
 *
 * Вид и дата-якорь живут в URL (?view=day&date=2026-09-08) — тот же принцип,
 * что у страницы расходов: ссылку можно сохранить, «назад» в браузере работает
 * предсказуемо, а сервер знает заранее, какой диапазон дел прислать.
 *
 * Месяц — только сетка с точками-индикаторами; клик по числу дня «приближает»
 * до дневного вида, где уже видно почасовую раскладку — так же, как в Apple
 * Calendar тап по дню в месяце открывает день, а не разворачивает список тут же.
 */

export type CalendarView = "month" | "week" | "day";

interface EventCalendarProps {
  view: CalendarView;
  anchorDate: IsoDate;
  events: CalendarEvent[];
  today: IsoDate;
}

const VIEW_LABELS: Record<CalendarView, string> = { day: "День", week: "Неделя", month: "Месяц" };

export function EventCalendar({ view, anchorDate, events, today }: EventCalendarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [editorTarget, setEditorTarget] = useState<EventEditorTarget | null>(null);

  function navigate(nextView: CalendarView, nextDate: IsoDate): void {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", nextView);
    params.set("date", nextDate);
    router.push(`${pathname}?${params.toString()}`);
  }

  function goBy(offset: number): void {
    if (view === "month") {
      const [year = 2026, month = 1] = anchorDate.split("-").map(Number);
      const date = new Date(year, month - 1 + offset, 1);
      navigate(view, `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`);
      return;
    }
    navigate(view, addDays(anchorDate, view === "week" ? offset * 7 : offset));
  }

  const eventsByDate = useMemo(() => {
    const map = new Map<IsoDate, CalendarEvent[]>();
    for (const event of events) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [events]);

  function openEditorFor(event: CalendarEvent): void {
    setEditorTarget({ date: event.date, event });
  }

  function openNewEditor(date: IsoDate, time = ""): void {
    setEditorTarget({ date, event: null, defaultStartTime: time });
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {/* Навигация по периоду */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Назад"
            onClick={() => goBy(-1)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
          >
            <ChevronLeft size={18} />
          </button>

          <button
            type="button"
            onClick={() => navigate(view, todayIso())}
            className="cursor-pointer whitespace-nowrap px-1 text-[15px] font-semibold text-ink hover:text-accent"
          >
            {formatViewTitle(view, anchorDate)}
          </button>

          <button
            type="button"
            aria-label="Вперёд"
            onClick={() => goBy(1)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Переключатель вида */}
          <div role="tablist" aria-label="Вид календаря" className="flex rounded-full border border-line bg-surface p-1">
            {(["day", "week", "month"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={view === option}
                onClick={() => navigate(option, anchorDate)}
                className={cn(
                  "cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors duration-200",
                  view === option ? "bg-accent text-accent-ink" : "text-ink-muted hover:text-ink",
                )}
              >
                {VIEW_LABELS[option]}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => openNewEditor(view === "week" ? clampToWeek(anchorDate, today) : anchorDate)}
            className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13px] font-medium text-accent-ink transition-[filter] duration-200 hover:brightness-110"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Добавить</span>
          </button>
        </div>
      </div>

      {view === "month" ? (
        <MonthGrid
          anchorDate={anchorDate}
          eventsByDate={eventsByDate}
          today={today}
          onOpenDay={(date) => navigate("day", date)}
        />
      ) : (
        <TimeGrid
          days={view === "day" ? [anchorDate] : weekDays(anchorDate)}
          eventsByDate={eventsByDate}
          today={today}
          onEventClick={openEditorFor}
          onSlotClick={openNewEditor}
        />
      )}

      <EventEditor target={editorTarget} onClose={() => setEditorTarget(null)} />
    </>
  );
}

// ─── Заголовок периода ─────────────────────────────────────────────────────────

function formatViewTitle(view: CalendarView, anchorDate: IsoDate): string {
  if (view === "month") return formatMonthTitle(anchorDate);
  if (view === "day") {
    return `${WEEKDAY_NAMES[weekdayOf(anchorDate)]}, ${formatDayMonth(anchorDate)}`;
  }

  const start = startOfWeek(anchorDate);
  const end = endOfWeek(anchorDate);
  return start.slice(0, 7) === end.slice(0, 7)
    ? `${Number(start.slice(8, 10))}–${formatDayMonth(end)}`
    : `${formatDayMonth(start)} – ${formatDayMonth(end)}`;
}

function weekDays(anchorDate: IsoDate): IsoDate[] {
  const start = startOfWeek(anchorDate);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

/** Для кнопки «Добавить» в недельном виде — сегодня, если он в этой неделе, иначе понедельник. */
function clampToWeek(anchorDate: IsoDate, today: IsoDate): IsoDate {
  const days = weekDays(anchorDate);
  return days.includes(today) ? today : (days[0] ?? anchorDate);
}

// ─── Месяц ───────────────────────────────────────────────────────────────────

function MonthGrid({
  anchorDate,
  eventsByDate,
  today,
  onOpenDay,
}: {
  anchorDate: IsoDate;
  eventsByDate: Map<IsoDate, CalendarEvent[]>;
  today: IsoDate;
  onOpenDay: (date: IsoDate) => void;
}) {
  const monthKey = anchorDate.slice(0, 7);

  const gridDays = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(anchorDate));
    const gridEnd = endOfWeek(endOfMonth(anchorDate));
    const days: IsoDate[] = [];
    for (let cursor = gridStart; cursor <= gridEnd; cursor = addDays(cursor, 1)) {
      days.push(cursor);
    }
    return days;
  }, [anchorDate]);

  return (
    <div
      data-spotlight
      className="glass glass-blur spotlight relative rounded-[14px] border border-line bg-surface/88 p-3 sm:p-4"
    >
      <div className="grid grid-cols-7 gap-1">
        {([1, 2, 3, 4, 5, 6, 7] as const).map((weekday) => (
          <p key={weekday} className="eyebrow py-1.5 text-center !text-[10px]" aria-hidden>
            {WEEKDAY_SHORT[weekday]}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {gridDays.map((day) => {
          const inMonth = day.slice(0, 7) === monthKey;
          const isToday = day === today;
          const dayEvents = eventsByDate.get(day) ?? [];

          return (
            <button
              key={day}
              type="button"
              onClick={() => onOpenDay(day)}
              className={cn(
                "flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px]",
                "transition-colors duration-200",
                isToday
                  ? "bg-accent-soft text-accent"
                  : inMonth
                    ? "text-ink hover:bg-surface-2"
                    : "text-ink-faint hover:bg-surface-2",
              )}
            >
              <span className="tabular text-[13px] font-medium leading-none">
                {Number(day.slice(8, 10))}
              </span>

              {dayEvents.length > 0 ? (
                <span className="flex gap-[3px]" aria-hidden>
                  {dayEvents.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      className="h-[5px] w-[5px] rounded-full"
                      style={{ backgroundColor: event.color }}
                    />
                  ))}
                </span>
              ) : (
                <span className="h-[5px]" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
